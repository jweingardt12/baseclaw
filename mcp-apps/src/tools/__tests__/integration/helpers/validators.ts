/**
 * Response shape validators for integration tests.
 * Each returns { valid, errors } for clear assertion messages.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateNoError(data: any): ValidationResult {
  var errors: string[] = [];
  if (data && typeof data === "object") {
    if (data.error) {
      errors.push("Response contains error: " + data.error);
    }
    if (data.status_code && data.status_code >= 400) {
      errors.push("Response status_code: " + data.status_code);
    }
  }
  return { valid: errors.length === 0, errors: errors };
}

export function validatePlayerArray(data: any, arrayKey: string, requiredFields: string[]): ValidationResult {
  var errors: string[] = [];
  var arr = data[arrayKey];
  if (!arr) {
    errors.push("Missing key: " + arrayKey);
    return { valid: false, errors: errors };
  }
  if (!Array.isArray(arr)) {
    errors.push(arrayKey + " is not an array");
    return { valid: false, errors: errors };
  }
  if (arr.length === 0) {
    errors.push(arrayKey + " is empty");
    return { valid: false, errors: errors };
  }
  var first = arr[0];
  for (var field of requiredFields) {
    if (first[field] === undefined) {
      errors.push("First item missing field: " + field);
    }
  }
  return { valid: errors.length === 0, errors: errors };
}

export function validateObject(data: any, requiredKeys: string[]): ValidationResult {
  var errors: string[] = [];
  if (!data || typeof data !== "object") {
    errors.push("Response is not an object");
    return { valid: false, errors: errors };
  }
  for (var key of requiredKeys) {
    if (data[key] === undefined) {
      errors.push("Missing key: " + key);
    }
  }
  return { valid: errors.length === 0, errors: errors };
}

export function validateNumericRange(value: any, min: number, max: number, label: string): ValidationResult {
  var errors: string[] = [];
  if (typeof value !== "number") {
    errors.push(label + " is not a number: " + typeof value);
    return { valid: false, errors: errors };
  }
  if (value < min || value > max) {
    errors.push(label + " out of range [" + min + ", " + max + "]: " + value);
  }
  return { valid: errors.length === 0, errors: errors };
}
