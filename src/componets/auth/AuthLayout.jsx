import React from 'react'
import './Auth.css'

export default function AuthLayout({ children }) {
  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        {children}
      </div>
    </div>
  )
}