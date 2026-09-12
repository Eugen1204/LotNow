from starlette.websockets import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, lot_id: int):
        await websocket.accept()
        if lot_id not in self.active_connections:
            self.active_connections[lot_id] = []
        self.active_connections[lot_id].append(websocket)

    async def disconnect(self, websocket: WebSocket, lot_id: int):
        if lot_id in self.active_connections:
            self.active_connections[lot_id].remove(websocket)

    async def broadcast(self, lot_id: int, message: str):
        for websocket in self.active_connections.get(lot_id, []):
            await websocket.send_text(message)

