'use client';

import React, { useState, useEffect } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  helperText?: string;
  onValidationChange?: (isValid: boolean) => void;
}

// Country codes for common countries
const countryCodes = [
  { code: '+1', country: 'US/CA', digitCount: 10 },
  { code: '+44', country: 'UK', digitCount: 10 },
  { code: '+91', country: 'IN', digitCount: 10 },
  { code: '+61', country: 'AU', digitCount: 9 },
  { code: '+52', country: 'MX', digitCount: 10 },
  { code: '+33', country: 'FR', digitCount: 9 },
  { code: '+49', country: 'DE', digitCount: 10 },
  { code: '+81', country: 'JP', digitCount: 10 },
  { code: '+86', country: 'CN', digitCount: 11 },
  { code: '+55', country: 'BR', digitCount: 10 },
];

// Get expected digit count for a country code
const getDigitCount = (countryCode: string): number => {
  const country = countryCodes.find(c => c.code === countryCode);
  return country?.digitCount || 10; // Default to 10 digits if country not found
};

// Format phone number for display based on country code
const formatPhoneNumber = (phoneNumber: string, countryCode: string): string => {
  // Only format US/Canada numbers with (xxx) xxx-xxxx
  if (countryCode === '+1' && phoneNumber.length === 10) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  }
  return phoneNumber;
};

export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  value,
  onChange,
  label = 'Phone Number',
  required = false,
  placeholder = '(555) 123-4567',
  id = 'phoneNumber',
  className = '',
  helperText = 'Enter your phone number',
  onValidationChange
}) => {
  // Parse the initial value to extract country code and number
  const parsePhoneValue = (phoneValue: string): { countryCode: string; phoneNumber: string } => {
    // Default to +1 if no country code is provided
    if (!phoneValue) {
      return { countryCode: '+1', phoneNumber: '' };
    }
    
    // Check if the value already has a country code
    const match = phoneValue.match(/^(\+\d+)(.*)$/);
    if (match) {
      const [, countryCode, number] = match;
      // Find if this is a supported country code
      const isSupported = countryCodes.some(c => c.code === countryCode);
      return {
        countryCode: isSupported ? countryCode : '+1',
        phoneNumber: isSupported ? number : phoneValue.replace(/^\+/, '')
      };
    }
    
    // No country code found, assume it's just the number
    return { countryCode: '+1', phoneNumber: phoneValue.replace(/^\+/, '') };
  };

  const { countryCode, phoneNumber } = parsePhoneValue(value);
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCode);
  const [localPhoneNumber, setLocalPhoneNumber] = useState(phoneNumber);
  const [isValid, setIsValid] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const expectedDigits = getDigitCount(selectedCountryCode);

  // Update the parent component whenever either part changes
  const handleCountryCodeChange = (newCode: string) => {
    setSelectedCountryCode(newCode);
    onChange(`${newCode}${localPhoneNumber}`);
  };

  // Validate the phone number
  useEffect(() => {
    if (!localPhoneNumber) {
      setIsValid(false);
      setValidationMessage(required ? 'Phone number is required' : '');
    } else if (!/^\d+$/.test(localPhoneNumber)) {
      setIsValid(false);
      setValidationMessage('Phone number should only contain digits');
    } else if (localPhoneNumber.length !== expectedDigits) {
      setIsValid(false);
      setValidationMessage(`Phone number should be ${expectedDigits} digits for ${selectedCountryCode}`);
    } else {
      setIsValid(true);
      setValidationMessage('');
    }
    
    // Notify parent component about validation status if callback provided
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [localPhoneNumber, selectedCountryCode, required, expectedDigits, onValidationChange, isValid]);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digit characters
    const digits = e.target.value.replace(/\D/g, '');
    
    // Limit input to expected digit count for selected country
    const limitedDigits = digits.slice(0, expectedDigits);
    
    setLocalPhoneNumber(limitedDigits);
    onChange(`${selectedCountryCode}${limitedDigits}`);
  };

  // Display formatted phone number but maintain raw digits internally
  const displayValue = formatPhoneNumber(localPhoneNumber, selectedCountryCode);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label htmlFor={id}>{label}{required && ' *'}</Label>}
      <div className="flex">
        <Select value={selectedCountryCode} onValueChange={handleCountryCodeChange}>
          <SelectTrigger className="w-24 rounded-r-none">
            <SelectValue placeholder="+1" />
          </SelectTrigger>
          <SelectContent>
            {countryCodes.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.code} {country.country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          id={id}
          value={displayValue}
          onChange={handlePhoneNumberChange}
          className={`flex-1 rounded-l-none ${!isValid && localPhoneNumber ? 'border-red-500' : ''}`}
          placeholder={placeholder}
          required={required}
          aria-invalid={!isValid && localPhoneNumber ? 'true' : 'false'}
        />
      </div>
      {validationMessage ? (
        <p className="text-xs text-red-500">{validationMessage}</p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
};