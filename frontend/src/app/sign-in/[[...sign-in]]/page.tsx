import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="oxy-auth-container">
      <SignIn
        appearance={{
          elements: {
            rootBox: "oxy-clerk-root",
            card: "oxy-clerk-card",
            headerTitle: "oxy-clerk-title",
            headerSubtitle: "oxy-clerk-subtitle",
            socialButtonsBlockButton: "oxy-clerk-social-btn",
            formButtonPrimary: "oxy-clerk-primary-btn",
            footerActionLink: "oxy-clerk-link",
          },
        }}
      />
    </div>
  );
}
