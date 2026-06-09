import React from 'react'

// Boundary de último recurso: impede que um erro de render (ex.: um registro de
// vaga/empresa malformado vindo do sync semanal) derrube a página inteira numa
// tela branca. Mostra um fallback simples e deixa o resto do app funcionar.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log para o console (e qualquer coletor de erros) sem vazar p/ a UI.
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{
            minHeight: '60vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            fontFamily: 'system-ui, sans-serif', color: '#333', padding: 24, textAlign: 'center',
          }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Algo deu errado.</h1>
            <p style={{ margin: 0, color: '#666' }}>
              Não foi possível carregar esta página. Tente recarregar.
            </p>
            <a href="/" style={{ color: '#0a7', textDecoration: 'none' }}>Voltar ao início</a>
          </div>
        )
      )
    }
    return this.props.children
  }
}
