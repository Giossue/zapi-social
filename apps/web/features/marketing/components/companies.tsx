import { getTranslations } from "next-intl/server"

import Container from "./container"
import Images from "./images"

const Companies = async () => {
  const t = await getTranslations("marketing.companies")

  return (
    <div className="companies relative mt-16 flex w-full flex-col items-center justify-center overflow-hidden py-20">
      <Container>
        <div className="flex flex-col items-center justify-center">
          <h4 className="text-2xl font-medium lg:text-4xl">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="font-subheading italic">{chunks}</span>
              ),
            })}
          </h4>
        </div>
      </Container>

      <Container delay={0.1}>
        <div className="mx-auto flex max-w-xl flex-row flex-wrap items-center justify-center gap-8 pt-16 text-muted-foreground transition-all">
          <Images.company1 className="h-7 w-auto hover:text-foreground" />
          <Images.company2 className="h-7 w-auto hover:text-foreground" />
          <Images.company3 className="h-7 w-auto hover:text-foreground" />
          <Images.company6 className="h-7 w-auto hover:text-foreground" />
          <Images.company7 className="h-7 w-auto hover:text-foreground" />
          <Images.company9 className="h-7 w-auto hover:text-foreground" />
          <Images.company10 className="h-7 w-auto hover:text-foreground" />
        </div>
      </Container>
    </div>
  )
}

export default Companies
