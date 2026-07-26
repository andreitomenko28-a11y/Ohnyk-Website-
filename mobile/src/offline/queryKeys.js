// Query keys in one place.
//
// Keys are the cache's identity: a mutation that wants to refresh a list has
// to name exactly the key the list reads from. Spelling them inline in each
// screen is how a stale list survives a successful write, so they live here.

export const qk = {
  // Catalogue
  cooks: (query = '') => ['cooks', query],
  cookMenu: (cookId) => ['cookMenu', cookId],

  // Buyer
  cart: ['cart'],
  myOrders: ['myOrders'],

  // Cook area
  myDishes: ['myDishes'],
  cookOrders: ['cookOrders'],
  cookReviews: ['cookReviews'],

  // Courier area
  courierProfile: ['courierProfile'],
  courierAvailable: ['courierAvailable'],
  courierDeliveries: ['courierDeliveries'],
};
