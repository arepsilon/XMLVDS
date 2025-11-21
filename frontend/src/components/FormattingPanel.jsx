import React, { useState } from 'react';
import { Palette, Plus, Trash2 } from 'lucide-react';
import useStore from '../store';

const FormattingPanel = () => {
  const {
    customHeaders,
    addCustomHeader,
    removeCustomHeader,
    conditionalRules,
    addConditionalRule,
    removeConditionalRule
  } = useStore();

  const [newHeader, setNewHeader] = useState({
    text: '',
    mergeColumns: 1,
    formatting: {
      bold: true,
      fontSize: 14,
      backgroundColor: 'FF4472C4'
    }
  });

  const handleAddHeader = () => {
    if (newHeader.text.trim()) {
      addCustomHeader({ ...newHeader });
      setNewHeader({
        text: '',
        mergeColumns: 1,
        formatting: {
          bold: true,
          fontSize: 14,
          backgroundColor: 'FF4472C4'
        }
      });
    }
  };

  return (
    <div className="formatting-panel card">
      <div className="card-header">
        <Palette size={20} />
        <h2>Formatting</h2>
      </div>

      <div className="card-content">
        {/* Custom Headers Section */}
        <section className="formatting-section">
          <h3>Custom Headers</h3>

          <div className="header-input-group">
            <input
              type="text"
              placeholder="Header text"
              value={newHeader.text}
              onChange={(e) => setNewHeader({ ...newHeader, text: e.target.value })}
              className="input-text"
            />

            <input
              type="number"
              placeholder="Merge columns"
              value={newHeader.mergeColumns}
              onChange={(e) => setNewHeader({ ...newHeader, mergeColumns: parseInt(e.target.value) || 1 })}
              className="input-number"
              min="1"
            />

            <button
              onClick={handleAddHeader}
              className="btn-icon"
              title="Add Header"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="headers-list">
            {customHeaders.map((header, index) => (
              <div key={index} className="header-item">
                <span className="header-text">{header.text}</span>
                <span className="header-meta">
                  {header.mergeColumns > 1 && `(${header.mergeColumns} cols)`}
                </span>
                <button
                  onClick={() => removeCustomHeader(index)}
                  className="btn-icon btn-danger"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Conditional Formatting Section */}
        <section className="formatting-section">
          <h3>Conditional Formatting</h3>
          <p className="section-note">
            Rules from Tableau will be automatically applied.
            Additional rules can be added here.
          </p>

          {conditionalRules.length > 0 && (
            <div className="rules-list">
              {conditionalRules.map((rule, index) => (
                <div key={index} className="rule-item">
                  <span className="rule-field">{rule.field}</span>
                  <span className="rule-condition">
                    {rule.condition} {rule.threshold}
                  </span>
                  <button
                    onClick={() => removeConditionalRule(index)}
                    className="btn-icon btn-danger"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FormattingPanel;
