import { useTranslation } from 'react-i18next'

const Auth = () => {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto card">
        <h1 className="text-3xl font-bold text-center mb-4">{t('auth.title')}</h1>
        <p className="text-center text-veneko-text-secondary mb-6">{t('auth.subtitle')}</p>
        <div className="text-center">
          <div className="w-48 h-48 bg-gray-100 mx-auto mb-4 flex items-center justify-center rounded-lg">
            <span className="text-gray-500">QR Code Placeholder</span>
          </div>
          <p className="text-sm text-veneko-text-secondary">{t('auth.scanQR')}</p>
        </div>
      </div>
    </div>
  )
}

export default Auth
