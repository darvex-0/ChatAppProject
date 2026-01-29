import { useEffect } from 'react';

export default function CustomAlert({ message, onClose }) {
    useEffect(() => {
        // Basic animation or timeout could go here
    }, []);

    return (
        <div id="customAlert" style={{ display: 'block' }}>
            <div className="alert-content" dangerouslySetInnerHTML={{ __html: message }}></div>
            <div className="alert-buttons">
                <button className="alert-btn primary" style={{ background: 'var(--primary)', color: 'white' }} onClick={onClose}>OK</button>
            </div>
        </div>
    );
}
