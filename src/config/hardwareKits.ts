/**
 * Hardware Kit Configuration System
 *
 * Defines real hardware platforms (Arduino, ESP32, Raspberry Pi, etc.)
 * with their pin mappings and capabilities for sim-to-real code export.
 */

// ============================================================================
// TYPES
// ============================================================================

export type PinMode = 'input' | 'output' | 'analog_in' | 'analog_out' | 'pwm' | 'i2c_sda' | 'i2c_scl' | 'spi' | 'uart_tx' | 'uart_rx' | 'servo';

export interface HardwarePin {
  id: string;
  label: string;
  gpioNumber: number | string;
  supportedModes: PinMode[];
  voltage: 3.3 | 5;
  maxCurrentMa?: number;
  adcBits?: number;  // For analog pins
  pwmBits?: number;  // For PWM pins
}

export interface HardwareKit {
  id: string;
  name: string;
  manufacturer: string;
  processor: string;
  clockSpeedMhz: number;
  voltage: 3.3 | 5;
  flashKb: number;
  ramKb: number;
  description: string;
  imageUrl?: string;
  documentationUrl?: string;
  pins: HardwarePin[];
  supportedProtocols: ('I2C' | 'SPI' | 'UART' | 'PWM' | 'ADC' | 'DAC' | 'WiFi' | 'Bluetooth' | 'BLE')[];
  programmingLanguages: ('arduino' | 'micropython' | 'circuitpython' | 'c' | 'lerobot')[];
  libraries: HardwareLibrary[];
}

export interface HardwareLibrary {
  name: string;
  importStatement: string;
  description: string;
  required: boolean;
}

export interface RobotPinMapping {
  robotId: string;
  hardwareKitId: string;
  name: string;
  description: string;
  pinAssignments: PinAssignment[];
  sensorConfigs: SensorHardwareConfig[];
  motorConfigs: MotorHardwareConfig[];
  servoConfigs: ServoHardwareConfig[];
}

export interface PinAssignment {
  function: string;  // e.g., 'motor_left_pwm', 'ultrasonic_trig'
  pinId: string;
  mode: PinMode;
  notes?: string;
}

export interface SensorHardwareConfig {
  sensorType: 'ultrasonic' | 'ir' | 'imu' | 'encoder' | 'line_sensor' | 'temperature' | 'light';
  model?: string;
  pins: Record<string, string>;  // e.g., { trig: 'D9', echo: 'D10' }
  i2cAddress?: number;
  calibration?: Record<string, number>;
}

export interface MotorHardwareConfig {
  motorId: string;  // 'left', 'right', 'front_left', etc.
  driverType: 'L298N' | 'L293D' | 'TB6612' | 'DRV8833' | 'direct';
  pins: {
    enable?: string;
    in1?: string;
    in2?: string;
    pwm?: string;
  };
  maxPwm: number;
  inverted?: boolean;
}

export interface ServoHardwareConfig {
  servoId: string;
  pin: string;
  minPulseUs: number;
  maxPulseUs: number;
  minAngle: number;
  maxAngle: number;
  defaultAngle?: number;
}

// ============================================================================
// HARDWARE KIT DEFINITIONS
// ============================================================================

export const HARDWARE_KITS: HardwareKit[] = [
  // Arduino Uno
  {
    id: 'arduino-uno',
    name: 'Arduino Uno R3',
    manufacturer: 'Arduino',
    processor: 'ATmega328P',
    clockSpeedMhz: 16,
    voltage: 5,
    flashKb: 32,
    ramKb: 2,
    description: 'The classic Arduino board, perfect for beginners. 14 digital I/O pins, 6 analog inputs.',
    documentationUrl: 'https://docs.arduino.cc/hardware/uno-rev3',
    pins: [
      // Digital pins
      { id: 'D0', label: 'D0/RX', gpioNumber: 0, supportedModes: ['input', 'output', 'uart_rx'], voltage: 5 },
      { id: 'D1', label: 'D1/TX', gpioNumber: 1, supportedModes: ['input', 'output', 'uart_tx'], voltage: 5 },
      { id: 'D2', label: 'D2', gpioNumber: 2, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D3', label: 'D3~', gpioNumber: 3, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D4', label: 'D4', gpioNumber: 4, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D5', label: 'D5~', gpioNumber: 5, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D6', label: 'D6~', gpioNumber: 6, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D7', label: 'D7', gpioNumber: 7, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D8', label: 'D8', gpioNumber: 8, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D9', label: 'D9~', gpioNumber: 9, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D10', label: 'D10~', gpioNumber: 10, supportedModes: ['input', 'output', 'pwm', 'spi', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D11', label: 'D11~', gpioNumber: 11, supportedModes: ['input', 'output', 'pwm', 'spi', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D12', label: 'D12', gpioNumber: 12, supportedModes: ['input', 'output', 'spi'], voltage: 5 },
      { id: 'D13', label: 'D13', gpioNumber: 13, supportedModes: ['input', 'output', 'spi'], voltage: 5 },
      // Analog pins (can also be digital)
      { id: 'A0', label: 'A0', gpioNumber: 'A0', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A1', label: 'A1', gpioNumber: 'A1', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A2', label: 'A2', gpioNumber: 'A2', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A3', label: 'A3', gpioNumber: 'A3', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A4', label: 'A4/SDA', gpioNumber: 'A4', supportedModes: ['input', 'output', 'analog_in', 'i2c_sda'], voltage: 5, adcBits: 10 },
      { id: 'A5', label: 'A5/SCL', gpioNumber: 'A5', supportedModes: ['input', 'output', 'analog_in', 'i2c_scl'], voltage: 5, adcBits: 10 },
    ],
    supportedProtocols: ['I2C', 'SPI', 'UART', 'PWM', 'ADC'],
    programmingLanguages: ['arduino', 'c'],
    libraries: [
      { name: 'Servo', importStatement: '#include <Servo.h>', description: 'Control servo motors', required: false },
      { name: 'Wire', importStatement: '#include <Wire.h>', description: 'I2C communication', required: false },
      { name: 'NewPing', importStatement: '#include <NewPing.h>', description: 'Ultrasonic sensor library', required: false },
    ],
  },

  // Arduino Nano
  {
    id: 'arduino-nano',
    name: 'Arduino Nano',
    manufacturer: 'Arduino',
    processor: 'ATmega328P',
    clockSpeedMhz: 16,
    voltage: 5,
    flashKb: 32,
    ramKb: 2,
    description: 'Compact Arduino board with the same capabilities as Uno. Great for space-constrained projects.',
    documentationUrl: 'https://docs.arduino.cc/hardware/nano',
    pins: [
      { id: 'D0', label: 'D0/RX', gpioNumber: 0, supportedModes: ['input', 'output', 'uart_rx'], voltage: 5 },
      { id: 'D1', label: 'D1/TX', gpioNumber: 1, supportedModes: ['input', 'output', 'uart_tx'], voltage: 5 },
      { id: 'D2', label: 'D2', gpioNumber: 2, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D3', label: 'D3~', gpioNumber: 3, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D4', label: 'D4', gpioNumber: 4, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D5', label: 'D5~', gpioNumber: 5, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D6', label: 'D6~', gpioNumber: 6, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D7', label: 'D7', gpioNumber: 7, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D8', label: 'D8', gpioNumber: 8, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D9', label: 'D9~', gpioNumber: 9, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D10', label: 'D10~', gpioNumber: 10, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D11', label: 'D11~', gpioNumber: 11, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D12', label: 'D12', gpioNumber: 12, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'D13', label: 'D13', gpioNumber: 13, supportedModes: ['input', 'output'], voltage: 5 },
      { id: 'A0', label: 'A0', gpioNumber: 'A0', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A1', label: 'A1', gpioNumber: 'A1', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A2', label: 'A2', gpioNumber: 'A2', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A3', label: 'A3', gpioNumber: 'A3', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A4', label: 'A4/SDA', gpioNumber: 'A4', supportedModes: ['input', 'output', 'analog_in', 'i2c_sda'], voltage: 5, adcBits: 10 },
      { id: 'A5', label: 'A5/SCL', gpioNumber: 'A5', supportedModes: ['input', 'output', 'analog_in', 'i2c_scl'], voltage: 5, adcBits: 10 },
      { id: 'A6', label: 'A6', gpioNumber: 'A6', supportedModes: ['analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A7', label: 'A7', gpioNumber: 'A7', supportedModes: ['analog_in'], voltage: 5, adcBits: 10 },
    ],
    supportedProtocols: ['I2C', 'SPI', 'UART', 'PWM', 'ADC'],
    programmingLanguages: ['arduino', 'c'],
    libraries: [
      { name: 'Servo', importStatement: '#include <Servo.h>', description: 'Control servo motors', required: false },
      { name: 'Wire', importStatement: '#include <Wire.h>', description: 'I2C communication', required: false },
    ],
  },

  // ESP32 DevKit
  {
    id: 'esp32-devkit',
    name: 'ESP32 DevKit V1',
    manufacturer: 'Espressif',
    processor: 'ESP32-WROOM-32',
    clockSpeedMhz: 240,
    voltage: 3.3,
    flashKb: 4096,
    ramKb: 520,
    description: 'Powerful dual-core processor with WiFi and Bluetooth. Great for IoT robotics projects.',
    documentationUrl: 'https://docs.espressif.com/projects/esp-idf/en/latest/esp32/',
    pins: [
      { id: 'GPIO0', label: 'GPIO0', gpioNumber: 0, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO2', label: 'GPIO2', gpioNumber: 2, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO4', label: 'GPIO4', gpioNumber: 4, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO5', label: 'GPIO5', gpioNumber: 5, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3 },
      { id: 'GPIO12', label: 'GPIO12', gpioNumber: 12, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO13', label: 'GPIO13', gpioNumber: 13, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO14', label: 'GPIO14', gpioNumber: 14, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO15', label: 'GPIO15', gpioNumber: 15, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO16', label: 'GPIO16', gpioNumber: 16, supportedModes: ['input', 'output', 'pwm', 'uart_rx'], voltage: 3.3 },
      { id: 'GPIO17', label: 'GPIO17', gpioNumber: 17, supportedModes: ['input', 'output', 'pwm', 'uart_tx'], voltage: 3.3 },
      { id: 'GPIO18', label: 'GPIO18', gpioNumber: 18, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3 },
      { id: 'GPIO19', label: 'GPIO19', gpioNumber: 19, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3 },
      { id: 'GPIO21', label: 'GPIO21/SDA', gpioNumber: 21, supportedModes: ['input', 'output', 'pwm', 'i2c_sda'], voltage: 3.3 },
      { id: 'GPIO22', label: 'GPIO22/SCL', gpioNumber: 22, supportedModes: ['input', 'output', 'pwm', 'i2c_scl'], voltage: 3.3 },
      { id: 'GPIO23', label: 'GPIO23', gpioNumber: 23, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3 },
      { id: 'GPIO25', label: 'GPIO25/DAC1', gpioNumber: 25, supportedModes: ['input', 'output', 'pwm', 'analog_out', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO26', label: 'GPIO26/DAC2', gpioNumber: 26, supportedModes: ['input', 'output', 'pwm', 'analog_out', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO27', label: 'GPIO27', gpioNumber: 27, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO32', label: 'GPIO32', gpioNumber: 32, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO33', label: 'GPIO33', gpioNumber: 33, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO34', label: 'GPIO34', gpioNumber: 34, supportedModes: ['input', 'analog_in'], voltage: 3.3, adcBits: 12 },
      { id: 'GPIO35', label: 'GPIO35', gpioNumber: 35, supportedModes: ['input', 'analog_in'], voltage: 3.3, adcBits: 12 },
    ],
    supportedProtocols: ['I2C', 'SPI', 'UART', 'PWM', 'ADC', 'DAC', 'WiFi', 'Bluetooth', 'BLE'],
    programmingLanguages: ['arduino', 'micropython', 'c'],
    libraries: [
      { name: 'ESP32Servo', importStatement: '#include <ESP32Servo.h>', description: 'Servo control for ESP32', required: false },
      { name: 'Wire', importStatement: '#include <Wire.h>', description: 'I2C communication', required: false },
      { name: 'WiFi', importStatement: '#include <WiFi.h>', description: 'WiFi connectivity', required: false },
    ],
  },

  // Raspberry Pi Pico
  {
    id: 'rpi-pico',
    name: 'Raspberry Pi Pico',
    manufacturer: 'Raspberry Pi Foundation',
    processor: 'RP2040',
    clockSpeedMhz: 133,
    voltage: 3.3,
    flashKb: 2048,
    ramKb: 264,
    description: 'Low-cost, high-performance microcontroller with flexible I/O. Perfect for MicroPython projects.',
    documentationUrl: 'https://www.raspberrypi.com/documentation/microcontrollers/raspberry-pi-pico.html',
    pins: [
      { id: 'GP0', label: 'GP0', gpioNumber: 0, supportedModes: ['input', 'output', 'pwm', 'i2c_sda', 'uart_tx'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP1', label: 'GP1', gpioNumber: 1, supportedModes: ['input', 'output', 'pwm', 'i2c_scl', 'uart_rx'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP2', label: 'GP2', gpioNumber: 2, supportedModes: ['input', 'output', 'pwm', 'i2c_sda'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP3', label: 'GP3', gpioNumber: 3, supportedModes: ['input', 'output', 'pwm', 'i2c_scl'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP4', label: 'GP4', gpioNumber: 4, supportedModes: ['input', 'output', 'pwm', 'uart_tx'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP5', label: 'GP5', gpioNumber: 5, supportedModes: ['input', 'output', 'pwm', 'uart_rx'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP6', label: 'GP6', gpioNumber: 6, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP7', label: 'GP7', gpioNumber: 7, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP8', label: 'GP8', gpioNumber: 8, supportedModes: ['input', 'output', 'pwm', 'uart_tx'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP9', label: 'GP9', gpioNumber: 9, supportedModes: ['input', 'output', 'pwm', 'uart_rx'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP10', label: 'GP10', gpioNumber: 10, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP11', label: 'GP11', gpioNumber: 11, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP12', label: 'GP12', gpioNumber: 12, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP13', label: 'GP13', gpioNumber: 13, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP14', label: 'GP14', gpioNumber: 14, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP15', label: 'GP15', gpioNumber: 15, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP16', label: 'GP16', gpioNumber: 16, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP17', label: 'GP17', gpioNumber: 17, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP18', label: 'GP18', gpioNumber: 18, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP19', label: 'GP19', gpioNumber: 19, supportedModes: ['input', 'output', 'pwm', 'spi'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP20', label: 'GP20', gpioNumber: 20, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP21', label: 'GP21', gpioNumber: 21, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP22', label: 'GP22', gpioNumber: 22, supportedModes: ['input', 'output', 'pwm'], voltage: 3.3, pwmBits: 16 },
      { id: 'GP26', label: 'GP26/ADC0', gpioNumber: 26, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12, pwmBits: 16 },
      { id: 'GP27', label: 'GP27/ADC1', gpioNumber: 27, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12, pwmBits: 16 },
      { id: 'GP28', label: 'GP28/ADC2', gpioNumber: 28, supportedModes: ['input', 'output', 'pwm', 'analog_in'], voltage: 3.3, adcBits: 12, pwmBits: 16 },
    ],
    supportedProtocols: ['I2C', 'SPI', 'UART', 'PWM', 'ADC'],
    programmingLanguages: ['micropython', 'circuitpython', 'c'],
    libraries: [
      { name: 'machine', importStatement: 'from machine import Pin, PWM, I2C, ADC', description: 'Hardware access', required: true },
      { name: 'time', importStatement: 'import time', description: 'Time and delays', required: true },
    ],
  },

  // Arduino Mega
  {
    id: 'arduino-mega',
    name: 'Arduino Mega 2560',
    manufacturer: 'Arduino',
    processor: 'ATmega2560',
    clockSpeedMhz: 16,
    voltage: 5,
    flashKb: 256,
    ramKb: 8,
    description: 'Most pins, most memory. Ideal for complex robots with many sensors and actuators.',
    documentationUrl: 'https://docs.arduino.cc/hardware/mega-2560',
    pins: [
      // Just key pins for brevity - Mega has 54 digital + 16 analog
      { id: 'D2', label: 'D2', gpioNumber: 2, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D3', label: 'D3~', gpioNumber: 3, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D4', label: 'D4~', gpioNumber: 4, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D5', label: 'D5~', gpioNumber: 5, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D6', label: 'D6~', gpioNumber: 6, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D7', label: 'D7~', gpioNumber: 7, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D8', label: 'D8~', gpioNumber: 8, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D9', label: 'D9~', gpioNumber: 9, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D10', label: 'D10~', gpioNumber: 10, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D11', label: 'D11~', gpioNumber: 11, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D12', label: 'D12~', gpioNumber: 12, supportedModes: ['input', 'output', 'pwm', 'servo'], voltage: 5, pwmBits: 8 },
      { id: 'D13', label: 'D13~', gpioNumber: 13, supportedModes: ['input', 'output', 'pwm'], voltage: 5, pwmBits: 8 },
      { id: 'D20', label: 'D20/SDA', gpioNumber: 20, supportedModes: ['input', 'output', 'i2c_sda'], voltage: 5 },
      { id: 'D21', label: 'D21/SCL', gpioNumber: 21, supportedModes: ['input', 'output', 'i2c_scl'], voltage: 5 },
      { id: 'A0', label: 'A0', gpioNumber: 'A0', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A1', label: 'A1', gpioNumber: 'A1', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A2', label: 'A2', gpioNumber: 'A2', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A3', label: 'A3', gpioNumber: 'A3', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A4', label: 'A4', gpioNumber: 'A4', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
      { id: 'A5', label: 'A5', gpioNumber: 'A5', supportedModes: ['input', 'output', 'analog_in'], voltage: 5, adcBits: 10 },
    ],
    supportedProtocols: ['I2C', 'SPI', 'UART', 'PWM', 'ADC'],
    programmingLanguages: ['arduino', 'c'],
    libraries: [
      { name: 'Servo', importStatement: '#include <Servo.h>', description: 'Control up to 48 servos', required: false },
      { name: 'Wire', importStatement: '#include <Wire.h>', description: 'I2C communication', required: false },
    ],
  },
];

// ============================================================================
// DEFAULT PIN MAPPINGS FOR ROBOT KITS
// ============================================================================

export const DEFAULT_PIN_MAPPINGS: RobotPinMapping[] = [
  // Elegoo Smart Car V4 with Arduino Uno
  {
    robotId: 'elegoo-smart-car-v4',
    hardwareKitId: 'arduino-uno',
    name: 'Elegoo Smart Car V4 - Arduino Uno',
    description: 'Default pin mapping for Elegoo Smart Robot Car V4 using Arduino Uno',
    pinAssignments: [
      { function: 'motor_left_enable', pinId: 'D5', mode: 'pwm' },
      { function: 'motor_left_in1', pinId: 'D7', mode: 'output' },
      { function: 'motor_left_in2', pinId: 'D8', mode: 'output' },
      { function: 'motor_right_enable', pinId: 'D6', mode: 'pwm' },
      { function: 'motor_right_in1', pinId: 'D9', mode: 'output' },
      { function: 'motor_right_in2', pinId: 'D11', mode: 'output' },
      { function: 'ultrasonic_trig', pinId: 'D12', mode: 'output' },
      { function: 'ultrasonic_echo', pinId: 'D13', mode: 'input' },
      { function: 'servo_head', pinId: 'D3', mode: 'servo' },
      { function: 'ir_left', pinId: 'A0', mode: 'analog_in' },
      { function: 'ir_center', pinId: 'A1', mode: 'analog_in' },
      { function: 'ir_right', pinId: 'A2', mode: 'analog_in' },
    ],
    sensorConfigs: [
      {
        sensorType: 'ultrasonic',
        model: 'HC-SR04',
        pins: { trig: 'D12', echo: 'D13' },
      },
      {
        sensorType: 'line_sensor',
        model: '3-channel IR',
        pins: { left: 'A0', center: 'A1', right: 'A2' },
        calibration: { threshold: 500 },
      },
    ],
    motorConfigs: [
      {
        motorId: 'left',
        driverType: 'L298N',
        pins: { enable: 'D5', in1: 'D7', in2: 'D8' },
        maxPwm: 255,
      },
      {
        motorId: 'right',
        driverType: 'L298N',
        pins: { enable: 'D6', in1: 'D9', in2: 'D11' },
        maxPwm: 255,
      },
    ],
    servoConfigs: [
      {
        servoId: 'ultrasonic_head',
        pin: 'D3',
        minPulseUs: 544,
        maxPulseUs: 2400,
        minAngle: 0,
        maxAngle: 180,
        defaultAngle: 90,
      },
    ],
  },

  // Freenove 4WD with ESP32
  {
    robotId: 'freenove-4wd',
    hardwareKitId: 'esp32-devkit',
    name: 'Freenove 4WD - ESP32',
    description: 'Default pin mapping for Freenove 4WD Smart Car with ESP32',
    pinAssignments: [
      { function: 'motor_front_left_pwm', pinId: 'GPIO12', mode: 'pwm' },
      { function: 'motor_front_left_dir', pinId: 'GPIO13', mode: 'output' },
      { function: 'motor_front_right_pwm', pinId: 'GPIO14', mode: 'pwm' },
      { function: 'motor_front_right_dir', pinId: 'GPIO27', mode: 'output' },
      { function: 'motor_back_left_pwm', pinId: 'GPIO25', mode: 'pwm' },
      { function: 'motor_back_left_dir', pinId: 'GPIO26', mode: 'output' },
      { function: 'motor_back_right_pwm', pinId: 'GPIO32', mode: 'pwm' },
      { function: 'motor_back_right_dir', pinId: 'GPIO33', mode: 'output' },
      { function: 'ultrasonic_trig', pinId: 'GPIO4', mode: 'output' },
      { function: 'ultrasonic_echo', pinId: 'GPIO5', mode: 'input' },
      { function: 'servo_camera_pan', pinId: 'GPIO18', mode: 'servo' },
      { function: 'servo_camera_tilt', pinId: 'GPIO19', mode: 'servo' },
      { function: 'line_sensor_left', pinId: 'GPIO34', mode: 'analog_in' },
      { function: 'line_sensor_right', pinId: 'GPIO35', mode: 'analog_in' },
    ],
    sensorConfigs: [
      {
        sensorType: 'ultrasonic',
        model: 'HC-SR04',
        pins: { trig: 'GPIO4', echo: 'GPIO5' },
      },
      {
        sensorType: 'line_sensor',
        model: '2-channel IR',
        pins: { left: 'GPIO34', right: 'GPIO35' },
      },
    ],
    motorConfigs: [
      {
        motorId: 'front_left',
        driverType: 'TB6612',
        pins: { pwm: 'GPIO12', in1: 'GPIO13' },
        maxPwm: 255,
      },
      {
        motorId: 'front_right',
        driverType: 'TB6612',
        pins: { pwm: 'GPIO14', in1: 'GPIO27' },
        maxPwm: 255,
        inverted: true,
      },
      {
        motorId: 'back_left',
        driverType: 'TB6612',
        pins: { pwm: 'GPIO25', in1: 'GPIO26' },
        maxPwm: 255,
      },
      {
        motorId: 'back_right',
        driverType: 'TB6612',
        pins: { pwm: 'GPIO32', in1: 'GPIO33' },
        maxPwm: 255,
        inverted: true,
      },
    ],
    servoConfigs: [
      {
        servoId: 'camera_pan',
        pin: 'GPIO18',
        minPulseUs: 500,
        maxPulseUs: 2500,
        minAngle: 0,
        maxAngle: 180,
        defaultAngle: 90,
      },
      {
        servoId: 'camera_tilt',
        pin: 'GPIO19',
        minPulseUs: 500,
        maxPulseUs: 2500,
        minAngle: 0,
        maxAngle: 180,
        defaultAngle: 90,
      },
    ],
  },

  // SO-101 Robot Arm with Arduino Uno (STS3215 bus servos)
  {
    robotId: 'so-101',
    hardwareKitId: 'arduino-uno',
    name: 'SO-101 LeRobot Arm - Arduino Uno',
    description: 'Pin mapping for SO-101 6-DOF robot arm using Arduino Uno with STS3215 bus servos',
    pinAssignments: [
      { function: 'servo_bus_tx', pinId: 'D1', mode: 'uart_tx', notes: 'STS3215 bus TX' },
      { function: 'servo_bus_rx', pinId: 'D0', mode: 'uart_rx', notes: 'STS3215 bus RX' },
    ],
    sensorConfigs: [],
    motorConfigs: [],
    servoConfigs: [
      { servoId: 'shoulder_pan', pin: 'STS_ID1', minPulseUs: 500, maxPulseUs: 2500, minAngle: -180, maxAngle: 180, defaultAngle: 0 },
      { servoId: 'shoulder_lift', pin: 'STS_ID2', minPulseUs: 500, maxPulseUs: 2500, minAngle: -90, maxAngle: 90, defaultAngle: 0 },
      { servoId: 'elbow_flex', pin: 'STS_ID3', minPulseUs: 500, maxPulseUs: 2500, minAngle: -135, maxAngle: 135, defaultAngle: 0 },
      { servoId: 'wrist_flex', pin: 'STS_ID4', minPulseUs: 500, maxPulseUs: 2500, minAngle: -90, maxAngle: 90, defaultAngle: 0 },
      { servoId: 'wrist_roll', pin: 'STS_ID5', minPulseUs: 500, maxPulseUs: 2500, minAngle: -180, maxAngle: 180, defaultAngle: 0 },
      { servoId: 'gripper', pin: 'STS_ID6', minPulseUs: 500, maxPulseUs: 2500, minAngle: 0, maxAngle: 100, defaultAngle: 50 },
    ],
  },

  // Mini Quadcopter with ESP32
  {
    robotId: 'mini-quadcopter',
    hardwareKitId: 'esp32-devkit',
    name: 'Mini Quadcopter - ESP32',
    description: 'Pin mapping for custom ESP32-based mini quadcopter drone',
    pinAssignments: [
      { function: 'motor_front_left', pinId: 'GPIO12', mode: 'pwm' },
      { function: 'motor_front_right', pinId: 'GPIO13', mode: 'pwm' },
      { function: 'motor_back_left', pinId: 'GPIO14', mode: 'pwm' },
      { function: 'motor_back_right', pinId: 'GPIO27', mode: 'pwm' },
      { function: 'imu_sda', pinId: 'GPIO21', mode: 'i2c_sda' },
      { function: 'imu_scl', pinId: 'GPIO22', mode: 'i2c_scl' },
      { function: 'led_status', pinId: 'GPIO2', mode: 'output' },
      { function: 'battery_voltage', pinId: 'GPIO34', mode: 'analog_in' },
    ],
    sensorConfigs: [
      {
        sensorType: 'imu',
        model: 'MPU6050',
        pins: { sda: 'GPIO21', scl: 'GPIO22' },
        i2cAddress: 0x68,
      },
    ],
    motorConfigs: [
      { motorId: 'front_left', driverType: 'direct', pins: { pwm: 'GPIO12' }, maxPwm: 255 },
      { motorId: 'front_right', driverType: 'direct', pins: { pwm: 'GPIO13' }, maxPwm: 255 },
      { motorId: 'back_left', driverType: 'direct', pins: { pwm: 'GPIO14' }, maxPwm: 255 },
      { motorId: 'back_right', driverType: 'direct', pins: { pwm: 'GPIO27' }, maxPwm: 255 },
    ],
    servoConfigs: [],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getHardwareKit = (kitId: string): HardwareKit | undefined => {
  return HARDWARE_KITS.find(k => k.id === kitId);
};

export const getHardwareKitsForRobot = (robotId: string): HardwareKit[] => {
  const mappings = DEFAULT_PIN_MAPPINGS.filter(m => m.robotId === robotId);
  const kitIds = [...new Set(mappings.map(m => m.hardwareKitId))];
  return HARDWARE_KITS.filter(k => kitIds.includes(k.id));
};

export const getPinMapping = (robotId: string, kitId: string): RobotPinMapping | undefined => {
  return DEFAULT_PIN_MAPPINGS.find(m => m.robotId === robotId && m.hardwareKitId === kitId);
};

export const getCompatibleKits = (robotType: 'arm' | 'wheeled' | 'drone' | 'humanoid'): HardwareKit[] => {
  // All kits are compatible with all robot types (user can create custom mappings)
  // But we can suggest common pairings
  const suggestions: Record<string, string[]> = {
    arm: ['arduino-uno', 'arduino-mega', 'esp32-devkit'],
    wheeled: ['arduino-uno', 'arduino-nano', 'esp32-devkit', 'rpi-pico'],
    drone: ['esp32-devkit', 'rpi-pico'],
    humanoid: ['arduino-mega', 'esp32-devkit'],
  };

  const suggestedIds = suggestions[robotType] || [];
  return HARDWARE_KITS.filter(k => suggestedIds.includes(k.id));
};

export const validatePinMapping = (
  mapping: RobotPinMapping,
  kit: HardwareKit
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const usedPins = new Set<string>();

  for (const assignment of mapping.pinAssignments) {
    const pin = kit.pins.find(p => p.id === assignment.pinId);

    if (!pin) {
      errors.push(`Pin ${assignment.pinId} not found on ${kit.name}`);
      continue;
    }

    if (!pin.supportedModes.includes(assignment.mode)) {
      errors.push(`Pin ${assignment.pinId} does not support mode ${assignment.mode}`);
    }

    if (usedPins.has(assignment.pinId)) {
      errors.push(`Pin ${assignment.pinId} is assigned multiple times`);
    }
    usedPins.add(assignment.pinId);
  }

  return { valid: errors.length === 0, errors };
};
