from fastapi import WebSocket

from app.core.logging import logger


class WebSocketManager:
    """Manages active WebSocket connections subscribed to currency updates.

    Supports channel-based subscriptions (e.g., subscribing to "EURUSD" or "USDEGP")
    and handles graceful disconnects and concurrent connection safe broadcasting.
    """

    def __init__(self) -> None:
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        """Accept connection and subscribe it to a specific currency channel."""
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(
            "WebSocket client connected",
            channel=channel,
            active_subscribers=len(self.active_connections[channel]),
        )

    def disconnect(self, websocket: WebSocket, channel: str) -> None:
        """Remove connection from subscription channel."""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]
        logger.info(
            "WebSocket client disconnected",
            channel=channel,
            active_subscribers=len(self.active_connections.get(channel, set())),
        )

    async def broadcast_to_channel(self, channel: str, message: dict) -> None:
        """Broadcast JSON message to all clients subscribed to a channel."""
        if channel not in self.active_connections:
            return

        # Create list copy to prevent mutation exceptions during async loop
        subscribers = list(self.active_connections[channel])
        for ws in subscribers:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.warn(
                    "Error sending payload to websocket. Disconnecting.",
                    channel=channel,
                    error=str(exc),
                )
                self.disconnect(ws, channel)


ws_manager = WebSocketManager()
