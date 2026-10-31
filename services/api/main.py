import os
from io import StringIO
from math import prod
from typing import Annotated, Literal

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


PositiveInt = Annotated[int, Field(gt=0)]


class LayerConfig(BaseModel):
    type: Literal[
        "Conv2D",
        "MaxPooling2D",
        "GlobalAveragePooling2D",
        "Flatten",
        "Dense",
    ]
    filters: int = Field(default=32, gt=0, le=2048)
    units: int = Field(default=64, gt=0, le=10000)
    kernel_size: tuple[PositiveInt, PositiveInt] = (3, 3)
    pool_size: tuple[PositiveInt, PositiveInt] = (2, 2)
    padding: Literal["same", "valid"] = "valid"
    activation: Literal["relu", "softmax", "sigmoid", "tanh", "linear"] = "relu"


class ArchitectureConfig(BaseModel):
    family: Literal["CNN"]
    input_shape: tuple[PositiveInt, PositiveInt, PositiveInt]
    num_classes: int = Field(ge=2, le=10000)
    layers: list[LayerConfig] = Field(min_length=1, max_length=100)


class ValidationResult(BaseModel):
    valid: Literal[True] = True
    family: Literal["CNN"] = "CNN"
    output_shape: list[int]
    parameter_count: int


class TrainingConfig(BaseModel):
    input_shape: tuple[PositiveInt, PositiveInt, PositiveInt]
    num_classes: int = Field(ge=2, le=100)
    epochs: int = Field(default=5, ge=1, le=50)
    batch_size: int = Field(default=32, ge=1, le=256)
    learning_rate: float = Field(default=0.001, ge=1e-6, le=1.0)
    dataset_size: int = Field(default=256, ge=32, le=5000)


class TrainingResult(BaseModel):
    valid: Literal[True] = True
    family: Literal["CNN"] = "CNN"
    epochs: int
    num_classes: int
    loss: float
    accuracy: float
    loss_history: list[float]
    validation_loss_history: list[float]
    model_summary: str


def _build_synthetic_dataset(config: TrainingConfig) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed=42)
    samples = config.dataset_size
    images = rng.integers(0, 256, size=(samples,) + config.input_shape, dtype=np.uint8)
    labels = rng.integers(0, config.num_classes, size=samples)

    for index, label in enumerate(labels):
        images[index] = np.clip(images[index] + ((label + 1) * 16), 0, 255)

    images = images.astype(np.float32) / 255.0
    split = max(8, int(samples * 0.8))
    return images[:split], labels[:split], images[split:], labels[split:]


def _build_cnn_model(config: TrainingConfig) -> tf.keras.Model:
    filters = min(32, max(8, config.num_classes * 8))
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=config.input_shape),
        tf.keras.layers.Conv2D(filters=filters, kernel_size=(3, 3), activation="relu", padding="same"),
        tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
        tf.keras.layers.Conv2D(filters=filters * 2, kernel_size=(3, 3), activation="relu", padding="same"),
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dense(config.num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=config.learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def train_cnn(config: TrainingConfig) -> TrainingResult:
    if config.num_classes < 2:
        raise ValueError("num_classes debe ser mayor o igual a 2.")

    x_train, y_train, x_val, y_val = _build_synthetic_dataset(config)
    model = _build_cnn_model(config)

    history = model.fit(
        x_train,
        y_train,
        validation_data=(x_val, y_val),
        epochs=config.epochs,
        batch_size=config.batch_size,
        verbose=0,
    )

    last_loss = float(history.history["val_loss"][-1])
    last_accuracy = float(history.history["val_accuracy"][-1])
    loss_history = [float(value) for value in history.history["loss"]]
    validation_loss_history = [float(value) for value in history.history["val_loss"]]

    model_summary = StringIO()
    model.summary(print_fn=lambda line: model_summary.write(f"{line}\n"))

    return TrainingResult(
        epochs=config.epochs,
        num_classes=config.num_classes,
        loss=last_loss,
        accuracy=last_accuracy,
        loss_history=loss_history,
        validation_loss_history=validation_loss_history,
        model_summary=model_summary.getvalue(),
    )


def _reduce_dimension(size: int, kernel: int, padding: str) -> int:
    if padding == "same":
        return (size + kernel - 1) // kernel
    return (size - kernel) // kernel + 1


def validate_architecture(config: ArchitectureConfig) -> ValidationResult:
    shape = list(config.input_shape)
    parameter_count = 0

    for index, layer in enumerate(config.layers):
        if layer.type == "Conv2D":
            if len(shape) != 3:
                raise ValueError(f"La capa {index + 1} Conv2D requiere una entrada de tres dimensiones.")
            height, width, channels = shape
            kernel_height, kernel_width = layer.kernel_size
            next_height = _reduce_dimension(height, kernel_height, layer.padding)
            next_width = _reduce_dimension(width, kernel_width, layer.padding)
            if next_height <= 0 or next_width <= 0:
                raise ValueError(f"La capa {index + 1} Conv2D produce dimensiones no válidas.")
            parameter_count += (kernel_height * kernel_width * channels + 1) * layer.filters
            shape = [next_height, next_width, layer.filters]
        elif layer.type == "MaxPooling2D":
            if len(shape) != 3:
                raise ValueError(f"La capa {index + 1} MaxPooling2D requiere una entrada de tres dimensiones.")
            height, width, channels = shape
            pool_height, pool_width = layer.pool_size
            next_height = _reduce_dimension(height, pool_height, "valid")
            next_width = _reduce_dimension(width, pool_width, "valid")
            if next_height <= 0 or next_width <= 0:
                raise ValueError(f"La capa {index + 1} MaxPooling2D reduce la imagen a una forma no válida.")
            shape = [next_height, next_width, channels]
        elif layer.type == "GlobalAveragePooling2D":
            if len(shape) != 3:
                raise ValueError(f"La capa {index + 1} GlobalAveragePooling2D requiere una entrada de tres dimensiones.")
            shape = [shape[-1]]
        elif layer.type == "Flatten":
            if len(shape) < 2:
                raise ValueError(f"La capa {index + 1} Flatten requiere una entrada espacial.")
            shape = [prod(shape)]
        else:
            if len(shape) != 1:
                raise ValueError(f"La capa {index + 1} Dense requiere una entrada vectorial; añade Flatten o GlobalAveragePooling2D.")
            parameter_count += (shape[0] + 1) * layer.units
            shape = [layer.units]

    final_layer = config.layers[-1]
    if final_layer.type != "Dense":
        raise ValueError("La arquitectura debe terminar en una capa Dense de clasificación.")
    if final_layer.units != config.num_classes or final_layer.activation != "softmax":
        raise ValueError("La capa Dense final debe tener una unidad por clase y activación softmax.")

    return ValidationResult(output_shape=shape, parameter_count=parameter_count)


app = FastAPI(title="NeuroLab CNN API", version="0.1.0")
origins = ["http://localhost:5173"]
if os.getenv("WEB_ORIGIN"):
    origins.extend(origin.strip() for origin in os.environ["WEB_ORIGIN"].split(",") if origin.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "neurolab-cnn-api"}


@app.post("/api/v1/cnn/architectures/validate", response_model=ValidationResult)
def validate_cnn(config: ArchitectureConfig) -> ValidationResult:
    try:
        return validate_architecture(config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/v1/cnn/train", response_model=TrainingResult)
def train_cnn_endpoint(config: TrainingConfig) -> TrainingResult:
    try:
        return train_cnn(config)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:  # pragma: no cover - guarded at API boundary
        raise HTTPException(status_code=500, detail=f"No se pudo entrenar la CNN: {error}") from error