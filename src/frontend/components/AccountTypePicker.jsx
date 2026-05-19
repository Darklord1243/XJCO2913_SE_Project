import { CUSTOMER_ACCOUNT_TYPES } from '../utils/accountTypes';

export default function AccountTypePicker({
  name,
  legend = 'Account type',
  hint,
  value,
  onChange,
  className = '',
}) {
  return (
    <fieldset
      className={`account-type-picker${className ? ` ${className}` : ''}`}
    >
      <legend className="account-type-picker__legend">{legend}</legend>
      {hint ? <p className="account-type-picker__hint">{hint}</p> : null}
      <div
        className="account-type-picker__grid"
        role="radiogroup"
        aria-label={legend}
      >
        {CUSTOMER_ACCOUNT_TYPES.map((option) => {
          const isSelected = value === option.value;

          return (
            <label
              key={option.value}
              className={`plan-option${isSelected ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
              />
              <span className="plan-option__body">
                <span className="plan-option__top">
                  <strong>{option.label}</strong>
                  {isSelected ? (
                    <span
                      className="account-type-picker__badge"
                      aria-hidden="true"
                    >
                      Selected
                    </span>
                  ) : null}
                </span>
                <span className="plan-option__description">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
