export function tokenizeFormattedTtk(formattedTtk) {
  const text = String(formattedTtk || '');
  if (!text) {
    return [];
  }

  const hasSuffix = text.endsWith('s');
  const numericText = hasSuffix ? text.slice(0, -1) : text;
  const decimalIndex = numericText.indexOf('.');
  const integerPart = decimalIndex >= 0 ? numericText.slice(0, decimalIndex) : numericText;
  const fractionalPart = decimalIndex >= 0 ? numericText.slice(decimalIndex + 1) : '';
  const firstNonZeroIntegerIndex = integerPart.search(/[1-9]/);
  const hasAnyNonZeroDigit = /[1-9]/.test(numericText);
  const tokens = [];

  [...integerPart].forEach((char, index) => {
    if (!/\d/.test(char)) {
      tokens.push({ text: char, kind: 'default' });
      return;
    }

    if (char !== '0') {
      tokens.push({ text: char, kind: 'significant' });
      return;
    }

    if (!hasAnyNonZeroDigit || firstNonZeroIntegerIndex === -1 || index < firstNonZeroIntegerIndex) {
      tokens.push({ text: char, kind: 'muted' });
      return;
    }

    tokens.push({ text: char, kind: 'default' });
  });

  if (decimalIndex >= 0) {
    tokens.push({ text: '.', kind: 'separator' });
    [...fractionalPart].forEach((char) => {
      if (char === '0') {
        tokens.push({ text: char, kind: 'muted' });
      } else {
        tokens.push({ text: char, kind: 'significant' });
      }
    });
  }

  if (hasSuffix) {
    tokens.push({ text: 's', kind: 'suffix' });
  }

  return tokens;
}
