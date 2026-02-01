import * as React from "react";
import type { ContextMenuModel } from "@marketview/mv-core";

export function ContextMenu(props: {
    model: ContextMenuModel;
    onClose: () => void;
}) {
    const { model, onClose } = props;

    React.useEffect(() => {
        const onDoc = () => onClose();
        document.addEventListener("click", onDoc);
        return () => document.removeEventListener("click", onDoc);
    }, [onClose]);

    return (
        <div
            style={{
                position: "fixed",
                left: model.x,
                top: model.y,
                background: "#121a2b",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: 6,
                minWidth: 220,
                zIndex: 9999,
                color: "rgba(255,255,255,0.9)",
                boxShadow: "0 18px 40px rgba(0,0,0,0.45)"
            }}
        >
            {model.items.map((it) => (
                <button
                    key={it.id}
                    disabled={it.disabled}
                    onClick={() => {
                        it.onClick();
                        onClose();
                    }}
                    style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        border: 0,
                        background: "transparent",
                        color: it.disabled ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.9)",
                        cursor: it.disabled ? "not-allowed" : "pointer",
                        borderRadius: 8
                    }}
                >
                    <span>{it.label}</span>
                    {it.shortcut && (
                        <span style={{ float: "right", opacity: 0.7 }}>{it.shortcut}</span>
                    )}
                </button>
            ))}
        </div>
    );
}
