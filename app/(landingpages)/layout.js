// Caminho do arquivo: app/(landingpages)/layout.js

// Importações para corrigir o uso de ícones (FontAwesome)
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

// Este é o layout "limpo" que será usado por todas as landing pages.
export default function LandingPageLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        {children}
      </body>
    </html>
  );
}