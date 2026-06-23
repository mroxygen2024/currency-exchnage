import asyncio

from fastapi.testclient import TestClient

from app.main import app
from app.modules.currency.websocket import ws_manager


def test_websocket_connection_and_broadcast() -> None:
    """Test WebSocket connection flow, ack response, and broadcast messaging."""
    # TestClient allows testing WebSockets synchronously in Starlette/FastAPI
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
