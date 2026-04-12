/**
 * Win-Back Email Template
 * Sent to customers who haven't purchased in 30+ days
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

import {
  styles,
  EmailHeader,
  EmailFooter,
  DiscountBox,
  CTAButton,
} from './components.jsx';

export function WinBackEmail({
  customerName = 'friend',
  lastOrderDate = 'a while ago',
  discountCode = 'MISSYOU15',
  storeUrl = 'https://tresr.com/collections/new',
}) {
  return (
    <Html>
      <Head />
      <Preview>We miss you! Here's 15% off to welcome you back</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <EmailHeader />

          <Heading style={styles.heading}>
            Hey {customerName}, it's been a while!
          </Heading>

          <Text style={styles.textCenter}>
            We noticed you haven't shopped with us since {lastOrderDate}.
          </Text>

          <Text style={styles.text}>
            A lot has changed since then – new designs, new vibes, same quality you loved.
          </Text>

          <Text style={styles.text}>
            Here's <strong>15% off</strong> to welcome you back:
          </Text>

          <DiscountBox code={discountCode} />

          <CTAButton href={storeUrl}>See What's New</CTAButton>

          <Section style={{ textAlign: 'center', margin: '30px 0' }}>
            <Text style={{ ...styles.text, fontSize: '14px', fontStyle: 'italic' }}>
              Miss you,
              <br />
              <strong>The TRESR Team</strong>
            </Text>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

export default WinBackEmail;
