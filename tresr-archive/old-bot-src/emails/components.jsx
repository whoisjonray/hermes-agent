/**
 * Shared React Email Components for TRESR
 * These provide consistent styling across all email templates
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

// Brand colors
export const colors = {
  black: '#000000',
  white: '#ffffff',
  gray: '#666666',
  lightGray: '#f4f4f4',
  accent: '#000000',
};

// Shared styles
export const styles = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  container: {
    margin: '0 auto',
    padding: '40px 20px',
    maxWidth: '600px',
  },
  logo: {
    margin: '0 auto 30px',
    display: 'block',
  },
  heading: {
    color: colors.black,
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.3',
    margin: '0 0 20px',
    textAlign: 'center',
  },
  subheading: {
    color: colors.black,
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: '1.4',
    margin: '0 0 15px',
  },
  text: {
    color: colors.gray,
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 20px',
  },
  textCenter: {
    color: colors.gray,
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 20px',
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.black,
    borderRadius: '4px',
    color: colors.white,
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: '600',
    padding: '14px 28px',
    textDecoration: 'none',
    textAlign: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.white,
    border: `2px solid ${colors.black}`,
    borderRadius: '4px',
    color: colors.black,
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: '600',
    padding: '10px 20px',
    textDecoration: 'none',
    textAlign: 'center',
  },
  discountBox: {
    backgroundColor: colors.lightGray,
    borderRadius: '8px',
    padding: '25px',
    margin: '25px 0',
    textAlign: 'center',
  },
  discountCode: {
    color: colors.black,
    fontSize: '32px',
    fontWeight: '700',
    letterSpacing: '2px',
    margin: '0 0 8px',
  },
  discountLabel: {
    color: colors.gray,
    fontSize: '14px',
    margin: '0',
  },
  productCard: {
    backgroundColor: colors.lightGray,
    borderRadius: '8px',
    padding: '20px',
    margin: '15px 0',
  },
  productImage: {
    borderRadius: '4px',
    maxWidth: '100%',
  },
  hr: {
    borderColor: '#eaeaea',
    margin: '30px 0',
  },
  footer: {
    color: '#999',
    fontSize: '12px',
    lineHeight: '1.5',
    textAlign: 'center',
    margin: '30px 0 0',
  },
  socialLink: {
    color: colors.gray,
    textDecoration: 'none',
    margin: '0 10px',
  },
  featureRow: {
    textAlign: 'center',
    padding: '15px 0',
  },
  featureIcon: {
    fontSize: '20px',
    marginRight: '8px',
  },
  featureText: {
    color: colors.gray,
    fontSize: '14px',
  },
};

// Header component
export function EmailHeader({ logoUrl = 'https://tresr.com/logo.png' }) {
  return (
    <Section style={{ textAlign: 'center', marginBottom: '30px' }}>
      <Text style={{
        fontSize: '28px',
        fontWeight: '800',
        letterSpacing: '4px',
        color: colors.black,
        margin: '0'
      }}>
        TRESR
      </Text>
    </Section>
  );
}

// Footer component
export function EmailFooter({ unsubscribeUrl }) {
  return (
    <>
      <Hr style={styles.hr} />
      <Section style={styles.featureRow}>
        <Text style={styles.featureText}>
          Free shipping on $50+ | Easy 30-day returns | 4.9/5 customer rating
        </Text>
      </Section>
      <Section style={{ textAlign: 'center' }}>
        <Link href="https://instagram.com/tresr" style={styles.socialLink}>Instagram</Link>
        <Link href="https://tiktok.com/@tresr" style={styles.socialLink}>TikTok</Link>
        <Link href="https://tresr.com" style={styles.socialLink}>Shop</Link>
      </Section>
      <Text style={styles.footer}>
        TRESR | Shirts that get you.
        <br />
        <Link href={unsubscribeUrl || '#'} style={{ color: '#999' }}>Unsubscribe</Link>
      </Text>
    </>
  );
}

// Discount code box
export function DiscountBox({ code, label = 'Use at checkout' }) {
  return (
    <Section style={styles.discountBox}>
      <Text style={styles.discountCode}>{code}</Text>
      <Text style={styles.discountLabel}>{label}</Text>
    </Section>
  );
}

// CTA Button
export function CTAButton({ href, children, secondary = false }) {
  return (
    <Section style={{ textAlign: 'center', margin: '25px 0' }}>
      <Button href={href} style={secondary ? styles.buttonSecondary : styles.button}>
        {children}
      </Button>
    </Section>
  );
}

// Product card
export function ProductCard({ imageUrl, title, price, productUrl }) {
  return (
    <Section style={styles.productCard}>
      {imageUrl && (
        <Img src={imageUrl} alt={title} style={styles.productImage} width="100%" />
      )}
      <Text style={{ ...styles.subheading, textAlign: 'center', marginTop: '15px' }}>
        {title}
      </Text>
      <Text style={{ ...styles.textCenter, fontSize: '24px', fontWeight: '700', color: colors.black }}>
        ${price}
      </Text>
      {productUrl && (
        <CTAButton href={productUrl}>View Product</CTAButton>
      )}
    </Section>
  );
}

export default {
  colors,
  styles,
  EmailHeader,
  EmailFooter,
  DiscountBox,
  CTAButton,
  ProductCard,
};
