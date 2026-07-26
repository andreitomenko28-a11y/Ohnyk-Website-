// Native modules that have no JS implementation under jest-expo.
//
// Both packages ship their own mock; using those rather than hand-rolled stubs
// keeps the fake API in step with the real one when the packages are upgraded.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);
