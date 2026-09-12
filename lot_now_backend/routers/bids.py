from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from datetime import datetime, timezone
from manager.connection_manager import ConnectionManager
from database import async_session_maker
import asyncio
import json
from sqlalchemy import select
from models import Lot, Bid, User, LotStatus
from utils.security import SECRET_KEY, ALGORITHM

router = APIRouter()
manager = ConnectionManager()
bid_queue = asyncio.Queue()

@router.websocket("/ws/lots/{lot_id}")
async def websocket_endpoint(websocket: WebSocket,
                             lot_id: int,
                             token: str=Query(...)):
    async with async_session_maker() as session:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            result = await session.execute(select(User)
                    .where(User.id == int(user_id)))
            current_user = result.scalar_one_or_none()
            if not current_user:
                await websocket.close(code=1008)
                return
        except JWTError:
            await websocket.close(code=1008)
            return

    await manager.connect(websocket, lot_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await bid_queue.put({"lot_id": lot_id,
                                 "message": message,
                                 "websocket": websocket,
                                 "user_id": user_id
                                 })
    except WebSocketDisconnect:
        await manager.disconnect(websocket, lot_id)

async def process_bids():
    while True:
        big_data = await bid_queue.get()

        try:
            lot_id = big_data["lot_id"]
            message = big_data["message"]
            websocket = big_data["websocket"]
            user_id = big_data["user_id"]

            async with async_session_maker() as session:
                result = await session.execute(select(Lot).where(Lot.id == lot_id))
                lot = result.scalar_one_or_none()

                if not lot:
                    await websocket.send_text(json.dumps({
                        "type": "BID_ERROR",
                        "message": "Лот не найден",
                    }))
                    continue

                if lot.status != LotStatus.ACTIVE:
                    await websocket.send_text(json.dumps({
                        "type": "BID ERROR",
                        "message": "Торги завершены"}, ensure_ascii=False))
                    continue

                amount = message.get("amount")

                MAX_AMOUNT = 99_999_999.99
                if amount > MAX_AMOUNT:
                    await websocket.send_text(json.dumps({
                        "type": "BID_ERROR",
                        "message": "Сумма ставки слишком велика"
                    }, ensure_ascii=False))
                    continue

                if amount <= float(lot.current_price) + float(lot.min_step) - 0.01:
                    await websocket.send_text(json.dumps({
                        "type":"BID_ERROR",
                        "message":"Ставка слишком мала",
                    }, ensure_ascii=False))
                    continue

                new_bid = Bid(
                    user_id=int(user_id),
                    lot_id=lot_id,
                    amount=amount
                )

                session.add(new_bid)

                lot.current_price = amount
                lot.current_leader_id = int(user_id)

                await session.commit()

                await manager.broadcast(lot_id, json.dumps({
                    "type": "STATE_UPDATE",
                    "lot":{
                        "id": lot_id,
                        "current_price": amount,
                    }
                }, ensure_ascii=False))
        except Exception as e:
            print("ОШИБКА В ВОРКЕРЕ process_bids:", e)

async def autocompletion():
    while True:
        await asyncio.sleep(60)
        async with async_session_maker() as session:
            result = await session.execute(select(Lot).where(Lot.status == LotStatus.ACTIVE))
            lots = result.scalars().all()

            finished_lots = []

            for lot in lots:
                if lot.end_time < datetime.now(timezone.utc):
                    if lot.current_leader_id:
                        lot.status = LotStatus.SOLD
                    else:
                        lot.status = LotStatus.UNSOLD
                    finished_lots.append(lot)

            if finished_lots:
                await session.commit()

                for lot in finished_lots:
                    await manager.broadcast(lot.id, json.dumps({
                        "type": "AUCTION_FINISHED",
                        "lot_id": lot.id,
                        "status": lot.status.value
                    }, ensure_ascii=False))








