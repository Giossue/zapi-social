import type { SupportedLocale } from '@workspace/contracts';
import { createElement, type CSSProperties, type ReactElement } from 'react';
import { emailChrome } from './email-chrome';

type EmailDetail = {
  label: string;
  value: string;
};

type ZapiEmailTemplateInput = {
  locale: SupportedLocale;
  preview: string;
  title: string;
  description: string;
  action?: {
    label: string;
    url: string;
  };
  details?: EmailDetail[];
  notice?: string;
};

const bodyStyle: CSSProperties = {
  margin: 0,
  backgroundColor: '#f5f5f5',
  color: '#171717',
  fontFamily: 'Arial, Helvetica, sans-serif',
  lineHeight: 1.5,
  padding: '32px 16px',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  border: '1px solid #e5e5e5',
  borderRadius: '12px',
  borderSpacing: 0,
  overflow: 'hidden',
};

const contentStyle: CSSProperties = {
  padding: '32px',
};

const buttonStyle: CSSProperties = {
  display: 'inline-block',
  borderRadius: '8px',
  backgroundColor: '#171717',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1,
  padding: '14px 20px',
  textDecoration: 'none',
};

export function zapiEmailTemplate({
  locale,
  preview,
  title,
  description,
  action,
  details = [],
  notice,
}: ZapiEmailTemplateInput): ReactElement {
  return createElement(
    'html',
    { lang: locale },
    createElement(
      'head',
      null,
      createElement('meta', { charSet: 'utf-8' }),
      createElement('meta', {
        content: 'width=device-width, initial-scale=1',
        name: 'viewport',
      }),
      createElement('title', null, title),
    ),
    createElement(
      'body',
      { style: bodyStyle },
      createElement(
        'div',
        {
          style: {
            display: 'none',
            maxHeight: 0,
            maxWidth: 0,
            opacity: 0,
            overflow: 'hidden',
          },
        },
        preview,
      ),
      createElement(
        'table',
        {
          role: 'presentation',
          style: cardStyle,
        },
        createElement(
          'tbody',
          null,
          createElement(
            'tr',
            null,
            createElement(
              'td',
              { style: contentStyle },
              createElement(
                'p',
                {
                  style: {
                    margin: '0 0 28px',
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  },
                },
                'Zapi',
              ),
              createElement(
                'h1',
                {
                  style: {
                    margin: '0 0 12px',
                    fontSize: '24px',
                    lineHeight: 1.25,
                  },
                },
                title,
              ),
              createElement(
                'p',
                {
                  style: {
                    margin: details.length || action || notice ? '0 0 24px' : 0,
                    color: '#525252',
                    fontSize: '15px',
                  },
                },
                description,
              ),
              details.length
                ? createElement(
                    'table',
                    {
                      role: 'presentation',
                      style: {
                        width: '100%',
                        margin: action || notice ? '0 0 24px' : 0,
                        backgroundColor: '#fafafa',
                        border: '1px solid #e5e5e5',
                        borderRadius: '8px',
                        borderSpacing: 0,
                      },
                    },
                    createElement(
                      'tbody',
                      null,
                      ...details.map((detail) =>
                        createElement(
                          'tr',
                          { key: detail.label },
                          createElement(
                            'td',
                            {
                              style: {
                                padding: '10px 12px',
                                color: '#737373',
                                fontSize: '13px',
                                width: '38%',
                              },
                            },
                            detail.label,
                          ),
                          createElement(
                            'td',
                            {
                              style: {
                                padding: '10px 12px',
                                fontSize: '13px',
                                fontWeight: 700,
                              },
                            },
                            detail.value,
                          ),
                        ),
                      ),
                    ),
                  )
                : null,
              action
                ? createElement(
                    'p',
                    { style: { margin: notice ? '0 0 24px' : 0 } },
                    createElement(
                      'a',
                      { href: action.url, style: buttonStyle },
                      action.label,
                    ),
                  )
                : null,
              notice
                ? createElement(
                    'p',
                    {
                      style: {
                        margin: 0,
                        color: '#737373',
                        fontSize: '13px',
                      },
                    },
                    notice,
                  )
                : null,
            ),
          ),
          createElement(
            'tr',
            null,
            createElement(
              'td',
              {
                style: {
                  borderTop: '1px solid #e5e5e5',
                  color: '#737373',
                  fontSize: '12px',
                  padding: '20px 32px',
                },
              },
              emailChrome(locale).footer,
            ),
          ),
        ),
      ),
    ),
  );
}
