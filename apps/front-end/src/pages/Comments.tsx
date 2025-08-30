import { useTranslation } from 'react-i18next'

const Comments = () => {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">{t('navigation.comments')}</h1>
      <div className="max-w-2xl mx-auto">
        <div className="card mb-6">
          <p className="text-center text-veneko-text-secondary">
            Comments system coming soon...
          </p>
        </div>
      </div>
    </div>
  )
}

export default Comments
