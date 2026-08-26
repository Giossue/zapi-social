import Container from "./container"

interface MarketingPageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
}

const MarketingPageHeader = ({
  title,
  description,
}: MarketingPageHeaderProps) => {
  return (
    <Container>
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <h1 className="font-heading text-3xl leading-snug! font-medium md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-base text-accent-foreground/80 md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    </Container>
  )
}

export default MarketingPageHeader
