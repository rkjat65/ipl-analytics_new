import { Helmet } from 'react-helmet-async'

const DEFAULT_OG_IMAGE = '/og-default.png'
const SITE_NAME = 'RKJAT65 IPL Analytics'
const TWITTER_HANDLE = '@Rkjat65'

export default function SEO({ title, description, image, url, type = 'website' }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const ogImage = image || DEFAULT_OG_IMAGE
  const canonical = url || (typeof window !== 'undefined' ? window.location.href : '')

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}
