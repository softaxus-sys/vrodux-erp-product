/**
 * Minimal WebUSB type declarations for TypeScript.
 * Full spec: https://wicg.github.io/webusb/
 * Only declares what is used by useUsbPrinter.ts.
 */

interface USBDeviceFilter {
  vendorId?:         number;
  productId?:        number;
  classCode?:        number;
  subclassCode?:     number;
  protocolCode?:     number;
  serialNumber?:     string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBEndpoint {
  endpointNumber: number;
  direction:      "in" | "out";
  type:           "bulk" | "interrupt" | "isochronous";
  packetSize:     number;
}

interface USBAlternateInterface {
  interfaceClass:    number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  interfaceName?:    string;
  endpoints:         USBEndpoint[];
}

interface USBInterface {
  interfaceNumber: number;
  alternates:      USBAlternateInterface[];
  claimed:         boolean;
}

interface USBConfiguration {
  configurationValue: number;
  configurationName?: string;
  interfaces:         USBInterface[];
}

interface USBInTransferResult {
  data?:  DataView;
  status: "ok" | "stall" | "babble";
}

interface USBOutTransferResult {
  bytesWritten: number;
  status:       "ok" | "stall";
}

interface USBDevice {
  vendorId:          number;
  productId:         number;
  deviceClass:       number;
  deviceSubclass:    number;
  deviceProtocol:    number;
  deviceVersionMajor: number;
  deviceVersionMinor: number;
  deviceVersionSubminor: number;
  manufacturerName?: string;
  productName?:      string;
  serialNumber?:     string;
  configuration:     USBConfiguration | null;
  configurations:    USBConfiguration[];
  opened:            boolean;

  open():                                Promise<void>;
  close():                               Promise<void>;
  selectConfiguration(value: number):    Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
}

interface USB extends EventTarget {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

interface Navigator {
  usb?: USB;
}
