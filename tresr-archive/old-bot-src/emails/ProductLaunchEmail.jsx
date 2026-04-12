/**
 * Product Launch Email Template
 * Sent when a new product drops
 */

import {
  Body,
  Container,
  Head,
  Heading,
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

export function ProductLaunchEmail({
  productTitle = 'New Drop',
  productImage,
  productPrice = '29',
  productUrl = '#',
  category = 'lifestyle',
}) {
  return (
    <Html>
      <Head />
      <Preview>New drop: {productTitle}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <EmailHeader />

          <Heading style={styles.heading}>
            Fresh off the press
          </Heading>

          <Text style={styles.textCenter}>
            New design just dropped for the {category} lovers.
          </Text>

          {productImage && (
            <Section style={{ textAlign: 'center', margin: '30px 0' }}>
              <Img
                src={productImage}
                alt={productTitle}
                width="100%"
                style={{ borderRadius: '8px', maxWidth: '500px' }}
              />
            </Section>
          )}

          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Heading style={{ ...styles.subheading, margin: '0 0 10px' }}>
              {productTitle}
            </Heading>
            <Text style={{
              fontSize: '28px',
              fontWeight: '700',
              color: colors.black,
              margin: '0',
            }}>
              ${productPrice}
            </Text>
          </Section>

          <CTAButton href={productUrl}>Shop Now</CTAButton>

          <Section style={{
            backgroundColor: colors.lightGray,
            borderRadius: '8px',
            padding: '15px',
            margin: '25px 0',
            textAlign: 'center',
          }}>
            <Text style={{ ...styles.text, margin: '0', fontSize: '14px' }}>
              Limited stock. When it's gone, it's gone.
            </Text>
          </Section>

          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

export default ProductLaunchEmail;
