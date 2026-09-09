from main import _generate_prediction_insight


def test_critical_prediction_insight():
    features = [
        {"feature": "severity_type", "value": 1, "shap_value": 0.0577},
        {"feature": "num_events", "value": 2, "shap_value": 0.0577},
        {"feature": "num_resources", "value": 1, "shap_value": -0.0107},
        {"feature": "total_log_volume", "value": 51, "shap_value": 0.0891},
        {"feature": "location", "value": 704, "shap_value": 0.0765},
    ]

    insight = _generate_prediction_insight(2, features)

    assert insight["severity"] == "Critical"
    assert "total_log_volume" in insight["main_driver"]
    assert "location" in insight["main_driver"]
    assert "num_resources" in insight["reducing_factors"]


def test_normal_prediction_insight():
    features = [
        {"feature": "severity_type", "value": 0, "shap_value": -0.12},
        {"feature": "num_events", "value": 1, "shap_value": -0.08},
        {"feature": "num_resources", "value": 3, "shap_value": 0.02},
    ]

    insight = _generate_prediction_insight(0, features)

    assert insight["severity"] == "Normal"
    assert "severity_type" in insight["reducing_factors"]
    assert "num_events" in insight["reducing_factors"]


def test_feature_ranking():
    features = [
        {"feature": "location", "value": 704, "shap_value": 0.02},
        {"feature": "severity_type", "value": 1, "shap_value": 0.15},
        {"feature": "num_events", "value": 2, "shap_value": -0.08},
        {"feature": "total_log_volume", "value": 51, "shap_value": 0.12},
    ]

    insight = _generate_prediction_insight(2, features)

    assert insight["main_driver"] == "severity_type, total_log_volume"
    assert insight["reducing_factors"] == "num_events"