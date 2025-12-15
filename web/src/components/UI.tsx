import React from 'react';

export function Card(props: { title?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      {(props.title || props.subtitle || props.actions) && (
        <div className="cardHeader">
          <div>
            {props.title && <h1 className="h1">{props.title}</h1>}
            {props.subtitle && <div className="h2">{props.subtitle}</div>}
          </div>
          {props.actions ? <div className="row">{props.actions}</div> : null}
        </div>
      )}
      <div className="cardBody">{props.children}</div>
    </div>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' }) {
  const cls = ['btn'];
  if (props.variant === 'primary') cls.push('btnPrimary');
  if (props.variant === 'danger') cls.push('btnDanger');
  return (
    <button {...props} className={[...cls, props.className ?? ''].join(' ').trim()} />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={["input", props.className ?? ""].join(' ').trim()} />;
}

export function Badge(props: { tone?: 'green' | 'purple' | 'amber'; children: React.ReactNode }) {
  const cls = ['badge'];
  if (props.tone === 'green') cls.push('badgeGreen');
  if (props.tone === 'purple') cls.push('badgePurple');
  if (props.tone === 'amber') cls.push('badgeAmber');
  return <span className={cls.join(' ')}>{props.children}</span>;
}

export function Alert(props: { children: React.ReactNode }) {
  return <div className="alert">{props.children}</div>;
}
