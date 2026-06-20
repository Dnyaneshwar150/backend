# Building a Seat Booking System

Booking a movie or concert seat sounds simple until you actually try to build it. The moment more than one person can click the same seat at the same time, "simple" turns into a system that has to make split-second decisions correctly, every single time. Here's how the project is laid out, how to run it, and then the three biggest problems we ran into along the way.

## Folder Structure

```
backend/
  src/
    controllers/      # request/response handling, no business logic
    services/         # reserve, confirm, expire — the actual business rules
    repositories/      # the only layer that talks to MongoDB or Redis
    models/            # Mongoose schemas: Event, Seat, Reservation, Order
    redis/             # redis client + the lock script
    routes/
    middleware/        # validation, error handling
    jobs/              # scheduled reservation-expiry sweep
    utils/
    config/
    app.js
  .env.example
  package.json
```

Controllers stay thin on purpose — they just shape the request and response. Services hold the actual logic (what "reserving a seat" or "confirming a booking" means). Repositories are the only place allowed to touch the database, which keeps database calls predictable and easy to optimize in one spot instead of scattered everywhere.

## The Stack Behind All This

Nothing exotic here, on purpose. The API is built on Node.js and Express. MongoDB is the permanent store, and we use Mongoose on top of it as the ODM — it gives us schema validation and a cleaner query layer instead of writing raw driver calls everywhere, which matters once you have seats, reservations, and orders all referencing each other. Redis handles everything temporary: seat holds and any short-lived caching we layer in for speed. Two databases doing two clearly separate jobs, instead of one database trying to do both.

## Want to Run It Yourself?

```bash
git clone <repo-url>
cd event-booking-backend
npm install
cp .env.example .env
# fill in MONGO_URI, REDIS_URL, and PORT inside .env
npm run dev
```

You'll need MongoDB and Redis running somewhere before starting the server — either locally, or pointed at hosted instances. The `.env` file is where those two connection strings live; the app won't start without them. Once it's up, the API is available at `http://localhost:<PORT>`, and you can hit `/api/events` to confirm it's talking to your database correctly.

---

With the project actually running, here are the three biggest problems we had to solve to make booking work correctly under real, concurrent traffic.

## Problem 1: What happens to a seat the moment someone picks it, but before they've paid?

When a user clicks a seat, it isn't booked yet — they still have to go through checkout and payment. But it also can't stay fully open, or two people could end up paying for the same seat at the same time. So we need some kind of "hold" on that seat for a few minutes.

The tricky part is: what if the user never finishes? They close the tab, their payment hangs, their internet drops. If we mark that seat as "held" inside our main database, someone now has to remember to go clean that up later, or the seat stays stuck forever even though nobody is actually buying it.

**Our solution:** we don't store the hold in the main database at all. We store it in Redis, and we give it an expiry time — 10 minutes. The hold key simply disappears on its own once the time is up. Nobody has to write cleanup code, and nobody has to remember to check it. If the user finishes checkout, great, we convert the hold into a real booking. If they disappear, the hold just quietly expires and the seat opens back up automatically. It's the simplest possible fix to the messiest part of the problem.

## Problem 2: What happens if two people click the exact same seat at the exact same moment?

This is the classic double-booking problem. Even with the Redis hold from Problem 1, we need to be absolutely sure that if two requests for the same seat land within milliseconds of each other, only one of them actually wins.

A naive way to handle this is to check "is the seat free?" and then separately "okay, book it" — but that gap between checking and booking is exactly where two people can sneak through at the same time and both think they succeeded.

**Our solution:** every seat carries a small number called a version. Every time a seat changes, the version goes up by one. When we go to confirm a booking, we don't just say "mark this seat as booked" — we say "mark this seat as booked, but only if the version is still the same number it was when this user started checking out." If someone else booked the seat a moment earlier, the version has already changed, and our update simply does nothing. We check for that and tell the second user the seat is gone. No locking, no waiting in line, no slow traffic jam of requests — just one quick, safe check built right into the update itself.

## Problem 3: What happens when the booking system has to handle real, heavy traffic without losing data?

A single booking actually involves several things happening together: the seat needs to flip from available to booked, an order needs to get created, and the reservation needs to be marked confirmed. If the server crashes halfway through — say, right after the seat is marked booked but before the order is created — we'd end up with a sold seat and no record of who bought it or whether they paid. That's a real problem, not an edge case, once you have enough traffic.

**Our solution:** we run MongoDB as a replica set, meaning the data is copied across multiple servers instead of living on just one. If one server goes down mid-process, the data isn't lost. On top of that, we wrap the seat update, the order creation, and the reservation update together in a single transaction — so MongoDB treats all of them as one unit. Either everything in that booking succeeds together, or none of it does. There's no in-between state where a seat is sold but nothing was actually recorded.

---

None of these solutions are flashy. They're each a fairly small, specific fix for a fairly specific failure mode — a hold that expires on its own, a version number that catches collisions, a transaction that refuses to leave things half-done. But that's usually how reliable systems actually get built: not one big clever idea, but three small ones, each aimed at the exact moment things could go wrong.
