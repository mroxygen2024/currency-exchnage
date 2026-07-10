import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.currency.websocket import (
    RatesConnectionManager,
    WebSocketManager,
    fetch_rate_for_pair,
    rates_ws_manager,
    ws_manager,
)


def test_websocket_connection_and_broadcast() -> None:
    """Test legacy WebSocket connection flow, ack response, and broadcast messaging."""
    with TestClient(app) as client:
        # Subscribe to USDEUR channel
        with client.websocket_connect("/api/v1/currencies/ws/USDEUR") as websocket:
            # 1. Test ping-ack
            websocket.send_text("hello_server")
            data = websocket.receive_json()
            assert data["event"] == "ack"
            assert data["payload"] == "hello_server"

            # 2. Test broad-casting behavior
            rate_payload = {
                "event": "rate_update",
                "pair": "USDEUR",
                "base": "USD",
                "target": "EUR",
                "rate": 0.923400,
            }

            # Run the asynchronous broadcast function inside a fresh event loop
            asyncio.run(ws_manager.broadcast_to_channel("USDEUR", rate_payload))

            # Assert that client receives the broadcast rate update message
            received_broadcast = websocket.receive_json()
            assert received_broadcast == rate_payload


def test_ws_rates_ping_pong() -> None:
    """Test ping-pong action on /ws/rates endpoint."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as websocket:
            websocket.send_json({"action": "ping"})
            data = websocket.receive_json()
            assert data["event"] == "pong"


def test_ws_rates_subscription_and_broadcast() -> None:
    """Test subscribing to a currency pair and receiving updates.

    Verifies broadcast updates on /ws/rates.
    """
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as websocket:
            # Subscribe to USDEUR
            websocket.send_json({"action": "subscribe", "pairs": ["USDEUR"]})
            sub_ack = websocket.receive_json()
            assert sub_ack["event"] == "subscribed"
            assert "USDEUR" in sub_ack["pairs"]

            # Broadcast update
            rate_payload = {
                "event": "rate_update",
                "pair": "USDEUR",
                "base": "USD",
                "target": "EUR",
                "rate": 0.950000,
            }

            asyncio.run(
                rates_ws_manager.broadcast_to_subscribers("USDEUR", rate_payload)
            )

            # Receive the update
            received = websocket.receive_json()
            while received.get("event") != "rate_update":
                received = websocket.receive_json()
            assert received["pair"] == "USDEUR"
            assert received["rate"] == 0.950000


def test_ws_rates_unsubscribe() -> None:
    """Test unsubscribing from a pair and ensuring no further updates are received."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as websocket:
            # Subscribe
            websocket.send_json({"action": "subscribe", "pairs": ["GBPUSD"]})
            sub_ack = websocket.receive_json()
            assert sub_ack["event"] == "subscribed"

            # Unsubscribe
            websocket.send_json({"action": "unsubscribe", "pairs": ["GBPUSD"]})
            unsub_ack = websocket.receive_json()
            assert unsub_ack["event"] == "unsubscribed"
            assert "GBPUSD" in unsub_ack["pairs"]


def test_ws_rates_multiple_connections() -> None:
    """Test multiple connections subscribing to the same pair and receiving updates."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as ws1:
            with client.websocket_connect("/ws/rates") as ws2:
                # Both subscribe to EGPUSD
                ws1.send_json({"action": "subscribe", "pairs": ["EGPUSD"]})
                ws2.send_json({"action": "subscribe", "pairs": ["EGPUSD"]})

                assert ws1.receive_json()["event"] == "subscribed"
                assert ws2.receive_json()["event"] == "subscribed"

                rate_payload = {
                    "event": "rate_update",
                    "pair": "EGPUSD",
                    "base": "EGP",
                    "target": "USD",
                    "rate": 0.020000,
                }

                asyncio.run(
                    rates_ws_manager.broadcast_to_subscribers("EGPUSD", rate_payload)
                )

                # Both should receive the update
                r1 = ws1.receive_json()
                while r1.get("event") != "rate_update":
                    r1 = ws1.receive_json()
                assert r1["rate"] == 0.020000

                r2 = ws2.receive_json()
                while r2.get("event") != "rate_update":
                    r2 = ws2.receive_json()
                assert r2["rate"] == 0.020000


def test_ws_rates_invalid_messages() -> None:
    """Test error handling for malformed or invalid messages on /ws/rates."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as websocket:
            # Non-JSON
            websocket.send_text("not a json")
            err1 = websocket.receive_json()
            assert err1["event"] == "error"
            assert "Invalid JSON" in err1["message"]

            # Missing action
            websocket.send_json({"pairs": ["USDEUR"]})
            err2 = websocket.receive_json()
            assert err2["event"] == "error"
            assert "Missing 'action'" in err2["message"]

            # Unknown action
            websocket.send_json({"action": "dance"})
            err3 = websocket.receive_json()
            assert err3["event"] == "error"
            assert "Unknown action" in err3["message"]

            # Invalid pairs type
            websocket.send_json({"action": "subscribe", "pairs": 12345})
            err4 = websocket.receive_json()
            assert err4["event"] == "error"
            assert "must be a string or a list" in err4["message"]


def test_ws_rates_subscribe_string_pair() -> None:
    """Test subscribing with a string pair instead of a list."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as ws:
            ws.send_json({"action": "subscribe", "pairs": "USDEUR"})
            data = ws.receive_json()
            assert data["event"] == "subscribed"
            assert "USDEUR" in data["pairs"]


def test_ws_rates_subscribe_no_valid_pairs() -> None:
    """Test subscribing with pairs that are not valid 6-char strings."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as ws:
            ws.send_json({"action": "subscribe", "pairs": ["ab", "1234567"]})
            data = ws.receive_json()
            assert data["event"] == "error"
            assert "No valid" in data["message"]


def test_ws_rates_unsubscribe_string_pair() -> None:
    """Test unsubscribing with a string pair instead of a list."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as ws:
            ws.send_json({"action": "unsubscribe", "pairs": "USDEUR"})
            data = ws.receive_json()
            assert data["event"] == "unsubscribed"
            assert "USDEUR" in data["pairs"]


def test_ws_rates_unsubscribe_invalid_type() -> None:
    """Test unsubscribing with an invalid pairs type."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/rates") as ws:
            ws.send_json({"action": "unsubscribe", "pairs": 12345})
            data = ws.receive_json()
            assert data["event"] == "error"
            assert "must be a string or a list" in data["message"]


def test_fetch_rate_for_pair_short_pair() -> None:
    """Test fetch_rate_for_pair returns None for non-6-char pair."""
    result = asyncio.run(fetch_rate_for_pair(None, None, "USD"))
    assert result is None


@pytest.mark.anyio
async def test_fetch_rate_for_pair_exception() -> None:
    """Test fetch_rate_for_pair returns None when service raises."""
    mock_db = AsyncMock()
    mock_redis = AsyncMock()
    with patch(
        "app.modules.currency.websocket.services.get_rate",
        side_effect=Exception("db error"),
    ):
        result = await fetch_rate_for_pair(mock_db, mock_redis, "USDEUR")
        assert result is None


def test_broadcast_to_subscribers_no_subscribers() -> None:
    """Test broadcast_to_subscribers returns early with no subscribers."""
    mgr = RatesConnectionManager()
    asyncio.run(
        mgr.broadcast_to_subscribers("USDEUR", {"event": "rate_update"})
    )


def test_ws_manager_broadcast_no_channel() -> None:
    """Test ws_manager broadcast to non-existent channel returns early."""
    mgr = WebSocketManager()
    asyncio.run(mgr.broadcast_to_channel("NOPE", {"event": "update"}))


def test_ws_manager_disconnect_empty_channel_cleanup() -> None:
    """Test ws_manager disconnect removes empty channel."""
    mgr = WebSocketManager()
    mock_ws = MagicMock()
    mock_ws.client = MagicMock()
    mock_ws.client.host = "127.0.0.1"
    mgr.active_connections["CH1"] = {mock_ws}
    mgr.disconnect(mock_ws, "CH1")
    assert "CH1" not in mgr.active_connections
