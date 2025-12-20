"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
var functions = require("firebase-functions/v2/https");
var stripe_1 = require("stripe");
var stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil", // ✅ updated to match Stripe types
});
var endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
exports.stripeWebhook = functions.onRequest({ region: "us-central1", maxInstances: 1, memory: "256MiB" }, // ✅ corrected
function (req, res) {
    var sig = req.headers["stripe-signature"];
    var event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, // ✅ ensure raw body
        sig, endpointSecret);
    }
    catch (err) {
        console.error("⚠️ Webhook signature verification failed:", err.message);
        res.status(400).send("Webhook Error: ".concat(err.message));
        return;
    }
    // Handle Stripe event
    switch (event.type) {
        case "checkout.session.completed":
            console.log("✅ Checkout session completed:", event.data.object.id);
            break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
            console.log("\uD83D\uDD04 Subscription event: ".concat(event.type));
            break;
        default:
            console.log("Unhandled event type ".concat(event.type));
    }
    res.json({ received: true });
});
