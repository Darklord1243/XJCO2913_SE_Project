export const CUSTOMER_ACCOUNT_TYPES = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Regular customer pricing.',
  },
  {
    value: 'student',
    label: 'Student',
    description:
      '20% off hire plans (honour system; account type may be reviewed).',
  },
  {
    value: 'senior',
    label: 'Senior',
    description: '20% off hire plans for senior citizens (honour system).',
  },
];

export function getAccountTypeLabel(userType) {
  const match = CUSTOMER_ACCOUNT_TYPES.find((item) => item.value === userType);
  return match?.label || 'Standard';
}

export function getDiscountReasonLabel(discountReason) {
  switch (discountReason) {
    case 'student':
      return 'Student discount (20% off)';
    case 'senior':
      return 'Senior discount (20% off)';
    case 'frequent':
      return 'Frequent rider discount (20% off)';
    default:
      return null;
  }
}
