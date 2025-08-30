import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const Landing = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-veneko-primary to-veneko-secondary">
      <div className="max-w-4xl mx-auto text-center px-4">
        <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight">
          {t('landing.title')}
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
          {t('landing.subtitle')}
        </p>
        <div className="space-x-4">
          <Link
            to="/auth"
            className="btn-primary text-lg px-8 py-4 inline-block"
          >
            {t('landing.cta')}
          </Link>
          <Link
            to="/polls"
            className="btn-secondary text-lg px-8 py-4 inline-block"
          >
            {t('navigation.polls')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing
