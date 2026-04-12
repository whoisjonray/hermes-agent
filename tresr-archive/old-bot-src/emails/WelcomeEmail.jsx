/**
 * Welcome Email Template
 * Sent when a new customer signs up with 10% discount
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
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

export function WelcomeEmail({
  customerName = 'friend',
  discountCode = 'WELCOME10',
  storeUrl = 'https://tresr.com',
}) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to TRESR! Here's 10% off your first order</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <EmailHeader />

          <Heading style={styles.heading}>
            Welcome to the tribe, {customerName}!
          </Heading>

          <Text style={styles.textCenter}>
            You're now part of a community that gets it.
          </Text>

          <Text style={styles.text}>
            At TRESR, we don't make generic t-shirts. We make shirts that{' '}
            <strong>feel like they were made just for you</strong> – because they kind of were.
          </Text>

          <Text style={styles.text}>
            As a thank you for joining, here's <strong>10% off</strong> your first order:
          </Text>

          <DiscountBox code={discountCode} />

          <CTAButton href={storeUrl}>Shop Now</CTAButton>

          <Hr style={styles.hr} />

          <Section style={{ textAlign: 'center' }}>
            <Text style={{ ...styles.text, fontSize: '14px', fontStyle: 'italic' }}>
              P.S. We only email when we have something actually worth sharing. No spam, ever.
            </Text>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
