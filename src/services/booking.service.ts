import mongoose, { Types } from "mongoose";
import { Seat } from "../models/Seat.model";
import { Order, IOrderDocument } from "../models/Order.model";
import { Reservation } from "../models/Reservation.model";
import { releaseMultipleSeatLocks } from "../redis/seatLock";
import { AppError } from "../utils/AppError";

export interface ConfirmBookingInput {
  reservationId: string;
  paymentId: string;
}

export interface ConfirmBookingResult {
  orderId: string;
  totalPrice: number;
  status: string;
  paymentId: string;
}

export async function confirmBooking(
  input: ConfirmBookingInput,
): Promise<ConfirmBookingResult> {
  const { reservationId, paymentId } = input;

  if (!Types.ObjectId.isValid(reservationId)) {
    throw new AppError("Invalid reservation ID format", 400);
  }

  const reservation = await Reservation.findById(reservationId);

  if (!reservation) {
    throw new AppError("Reservation not found", 404);
  }

  if (reservation.status !== "pending") {
    if (reservation.status === "confirmed") {
      throw new AppError("Reservation has already been confirmed", 409);
    }
    if (reservation.status === "expired") {
      throw new AppError(
        "Reservation has expired. Please start a new reservation.",
        410,
      );
    }
    if (reservation.status === "cancelled") {
      throw new AppError("Reservation has been cancelled", 409);
    }
  }

  if (new Date() > reservation.expiresAt) {
    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { status: "expired" } },
    );
    throw new AppError(
      "Reservation has expired. Please start a new reservation.",
      410,
    );
  }

  const seats = await Seat.find({
    _id: { $in: reservation.seatIds },
  }).lean();

  if (seats.length !== reservation.seatIds.length) {
    throw new AppError("One or more seats could not be found", 500);
  }

  const totalPrice = seats.reduce((sum, seat) => sum + seat.price, 0);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const seatIdStrings = reservation.seatIds.map((id) => id.toString());

    for (const seat of seats) {
      const result = await Seat.updateOne(
        {
          _id: seat._id,
          status: "available", // Must still be available
          version: seat.version, // Version must not have changed
        },
        {
          $set: {
            status: "booked",
            orderId: null,
          },
          $inc: { version: 1 },
        },
        { session },
      );

      // modifiedCount = 0 means another process already modified this seat
      if (result.modifiedCount === 0) {
        throw new AppError(
          `Seat ${seat.seatNumber} is no longer available`,
          409,
        );
      }
    }

    const [order] = (await Order.create(
      [
        {
          userId: reservation.userId,
          eventId: reservation.eventId,
          seatIds: reservation.seatIds,
          totalPrice,
          status: "confirmed",
          paymentId,
        },
      ],
      { session },
    )) as IOrderDocument[];

    await Seat.updateMany(
      { _id: { $in: reservation.seatIds } },
      { $set: { orderId: order._id } },
      { session },
    );

    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { status: "confirmed" } },
      { session },
    );

    await session.commitTransaction();

    await releaseMultipleSeatLocks(
      reservation.eventId.toString(),
      seatIdStrings,
    );

    return {
      orderId: order._id.toString(),
      totalPrice: order.totalPrice,
      status: order.status,
      paymentId: order.paymentId,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
