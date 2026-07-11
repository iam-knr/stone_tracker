import { useEffect, useState } from 'react';
import api from '../api.js';

// Renders admin-defined extra inputs (appliesTo: 'invoice' | 'contact' |
// 'quote') and stores their values in a `customFields` object on the
// parent form. Renders nothing if no fields are defined for this record
// type, so forms that never used custom fields look exactly as before.
export default function CustomFieldsSection({ appliesTo, values, onChange }) {
  const [defs, setDefs] = useState([]);

  useEffect(() => {
    api.get('/custom-field-defs').then(({ data }) => {
      setDefs(data.filter((d) => d.appliesTo === appliesTo));
    }).catch(() => {});
  }, [appliesTo]);

  if (defs.length === 0) return null;

  function setField(key, value) {
    onChange({ ...(values || {}), [key]: value });
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Additional Fields</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {defs.map((def) => (
          <div key={def.id}>
            <label className="block text-xs text-gray-500 mb-1">{def.label}{def.required && ' *'}</label>
            <input
              type={def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'}
              required={!!def.required}
              value={(values && values[def.id]) ?? ''}
              onChange={(e) => setField(def.id, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
