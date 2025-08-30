import { useTranslation } from 'react-i18next'

const Polls = () => {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8">{t('polls.title')}</h1>
      <div className="text-center">
        <p className="text-xl text-veneko-text-secondary mb-6">{t('polls.noPolls')}</p>
        <button className="btn-primary">{t('polls.create')}</button>
      </div>
    </div>
  )
}

export default Polls
