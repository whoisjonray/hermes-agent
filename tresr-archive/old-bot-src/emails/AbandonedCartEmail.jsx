/**
 * Abandoned Cart Email Template
 * 3-email sequence: 1hr, 24hr, 48hr after cart abandonment
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

import {
  styles,
  colors,
  EmailHeader,
  EmailFooter,
  CTAButton,
} from './components.jsx';

// Email 1: Gentle reminder (1 hour)
export function AbandonedCartEmail1({
  customerName,
  items = [],
  cartUrl = '#',
}) {
  return (
    <Html>
      <Head />
      <Preview>You left something behind...</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <EmailHeader />

          <Heading style={styles.heading}>
            Hey{customerName ? ` ${customerName}` : ''}, you left something behind!
          </Heading>

          <Text style={styles.textCenter}>
            We noticed you were checking out these items:
          </Text>

          <Section style={{ margin: '25px 0' }}>
            {items.map((item, index) => (
              <Section key={index} style={{
                backgroundColor: colors.lightGray,
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
              }}>
                {item.image && (
                  <Img
                    src={item.image}
                    alt={item.title}
                    width="80"
                    height="80"
                    style={{ borderRadius: '4px', marginRight: '15px' }}
                  />
                )}
                <div>
                  <Text style={{ ...styles.subheading, margin: '0 0 5px', fontSize: '16px' }}>
                    {item.title}
                  </Text>
                  <Text style={{ margin: '0', color: colors.gray }}>
                    ${item.price}
                  </Text>
                </div>
              </Section>
            ))}
          </Section>

          <CTAButton href={cartUrl}>Complete Your Order</CTAButton>

          <Text style={{ ...styles.text, fontSize: '14px', textAlign: 'center' }}>
            Questions? Just reply to this email.
          </Text>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

// Email 2: Social proof (24 hours)
export function AbandonedCartEmail2({
  customerName,
  items = [],
  cartUrl = '#',
}) {
  return (
    <Html>
      <Head />
      <Preview>Still thinking about it?</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <EmailHeader />

          <Heading style={styles.heading}>
            Still on the fence?
          </Heading>

          <Text style={styles.textCenter}>
            No pressure, but your cart is getting lonely.
          </Text>

          <Text style={styles.text}>
            Here's what people are saying about their TRESR gear:
          </Text>

          <Section style={{
            borderLeft: '3px solid #000',
            paddingLeft: '20px',
            margin: '25px 0',
            fontStyle: 'italic',
          }}>
            <Text style={{ ...styles.text, margin: '0' }}>
              "Finally, a shirt that gets me. I've never had so many people ask where I got my tee."
            </Text>
            <Text style={{ color: colors.gray, fontSize: '14px', marginTop: '10px' }}>
              — Sarah M., verified buyer
            </Text>
          </Section>

          <Section style={{ margin: '25px 0' }}>
            {items.map((item, index) => (
              <Section key={index} style={{
                textAlign: 'center',
                marginBottom: '15px',
              }}>
                {item.image && (
                  <Img
                    src={item.image}
                    alt={item.title}
                    width="200"
                    style={{ borderRadius: '8px', margin: '0 auto' }}
                  />
                )}
                <Text style={{ ...styles.subheading, marginTop: '10px' }}>
                  {item.title} — ${item.price}
                </Text>
              </Section>
            ))}
          </Section>

          <CTAButton href={cartUrl}>Finish Checkout</CTAButton>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

// Email 3: Urgency (48 hours)
export function AbandonedCartEmail3({
  customerName,
  items = [],
  cartUrl = '#',
}) {
  return (
    <Html>
      <Head />
      <Preview>Your cart expires soon...</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <EmailHeader />

          <Heading style={styles.heading}>
            Your cart is about to expire
          </Heading>

          <Text style={styles.textCenter}>
            We've been holding these items for you, but we can't do it forever.
          </Text>

          <Text style={styles.text}>
            If you've changed your mind, no worries at all. But if you're still interested, now's the time.
          </Text>

          <Section style={{
            backgroundColor: colors.lightGray,
            borderRadius: '8px',
            padding: '20px',
            margin: '25px 0',
            textAlign: 'center',
          }}>
            {items.map((item, index) => (
              <Section key={index} style={{ marginBottom: '10px' }}>
                {item.image && (
                  <Img
                    src={item.image}
                    alt={item.title}
                    width="150"
                    style={{ borderRadius: '4px', margin: '0 auto' }}
                  />
                )}
                <Text style={{ ...styles.subheading, fontSize: '16px', margin: '10px 0 0' }}>
                  {item.title}
                </Text>
              </Section>
            ))}
          </Section>

          <CTAButton href={cartUrl}>Complete Order Now</CTAButton>

          <Text style={{ ...styles.text, fontSize: '14px', textAlign: 'center', fontStyle: 'italic' }}>
            This is our last reminder. After this, your cart will be cleared.
          </Text>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

// Default export for React Email preview (shows Email 1)
export default function AbandonedCartEmail(props) {
  return <AbandonedCartEmail1 {...props} />;
}

export { AbandonedCartEmail1, AbandonedCartEmail2, AbandonedCartEmail3 };
