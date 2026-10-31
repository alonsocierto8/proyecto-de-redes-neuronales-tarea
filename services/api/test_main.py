import unittest

from main import ArchitectureConfig, LayerConfig, TrainingConfig, train_cnn, validate_architecture


class ValidateArchitectureTests(unittest.TestCase):
    def test_valid_classifier_returns_output_shape_and_parameter_count(self):
        config = ArchitectureConfig(
            family="CNN",
            input_shape=(32, 32, 3),
            num_classes=3,
            layers=[
                LayerConfig(type="Conv2D", filters=8, padding="same"),
                LayerConfig(type="GlobalAveragePooling2D"),
                LayerConfig(type="Dense", units=3, activation="softmax"),
            ],
        )

        result = validate_architecture(config)

        self.assertEqual(result.output_shape, [3])
        self.assertEqual(result.parameter_count, 251)

    def test_dense_layer_rejects_spatial_input(self):
        config = ArchitectureConfig(
            family="CNN",
            input_shape=(32, 32, 3),
            num_classes=3,
            layers=[LayerConfig(type="Dense", units=3, activation="softmax")],
        )

        with self.assertRaisesRegex(ValueError, "entrada vectorial"):
            validate_architecture(config)

    def test_classifier_requires_softmax_and_one_unit_per_class(self):
        config = ArchitectureConfig(
            family="CNN",
            input_shape=(32, 32, 3),
            num_classes=3,
            layers=[
                LayerConfig(type="GlobalAveragePooling2D"),
                LayerConfig(type="Dense", units=2, activation="relu"),
            ],
        )

        with self.assertRaisesRegex(ValueError, "softmax"):
            validate_architecture(config)


class TrainCnnTests(unittest.TestCase):
    def test_training_returns_metrics_and_model_summary(self):
        config = TrainingConfig(
            input_shape=(32, 32, 3),
            num_classes=3,
            epochs=2,
            batch_size=8,
            dataset_size=32,
            learning_rate=0.01,
        )

        result = train_cnn(config)

        self.assertEqual(result.epochs, 2)
        self.assertEqual(result.num_classes, 3)
        self.assertGreaterEqual(result.loss, 0.0)
        self.assertGreaterEqual(result.accuracy, 0.0)
        self.assertEqual(len(result.loss_history), 2)
        self.assertEqual(len(result.validation_loss_history), 2)
        self.assertIn("Conv2D", result.model_summary)

    def test_training_rejects_invalid_class_count(self):
        with self.assertRaisesRegex(ValueError, "num_classes"):
            TrainingConfig(input_shape=(32, 32, 3), num_classes=1, epochs=1, batch_size=8)


if __name__ == "__main__":
    unittest.main()


if __name__ == "__main__":
    unittest.main()