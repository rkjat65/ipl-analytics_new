import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://crickrida.rkjat.in'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`
const SITE_NAME = 'Crickrida'
const TWITTER_HANDLE = '@Rkjat65'

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  keywords,
  jsonLd,
  noIndex = false,
}) {
  const fullTitle = title || SITE_NAME
  const ogImage = image || DEFAULT_OG_IMAGE
  const canonical = url || (typeof window !== 'undefined' ? window.location.href : '')

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  )
}
