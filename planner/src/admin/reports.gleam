import admin/model.{type Booking, type Money, Recorded, Unrecorded}
import gleam/list
import gleam/order
import gleam/string

// Inclusive Eastern confirmation-date filters. Missing amounts remain unknown.
pub fn in_period(bookings: List(Booking), from: String, through: String) {
  list.filter(bookings, fn(booking) {
    { from == "" || string.compare(booking.date, from) != order.Lt }
    && { through == "" || string.compare(booking.date, through) != order.Gt }
  })
}

pub fn amount_paid(booking: Booking) -> Money {
  case booking.subtotal, booking.discount {
    Recorded(subtotal), Recorded(discount) -> Recorded(subtotal - discount)
    _, _ -> Unrecorded
  }
}

pub fn revenue(bookings: List(Booking)) {
  list.fold(bookings, 0, fn(total, booking) {
    case amount_paid(booking) {
      Recorded(cents) -> total + cents
      Unrecorded -> total
    }
  })
}

pub fn discounts(bookings: List(Booking)) {
  list.fold(bookings, 0, fn(total, booking) {
    case booking.discount {
      Recorded(cents) -> total + cents
      Unrecorded -> total
    }
  })
}
