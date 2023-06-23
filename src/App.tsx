import {
  IonApp,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonImg,
  IonPage,
  IonRouterOutlet,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonToolbar,
} from "@ionic/react";
import { useUser } from "./context/UserContext";
import ConnectButton from "./components/ConnectButton";
import WalletDetail from "./components/WalletDetail";
import DisconnectButton from "./components/DisconnectButton";
import ShowUIButton from "./components/ShowUIButton";
import SignMessage from "./components/SignMessage";
import { HiddenUI, LiFiWidget, WidgetConfig } from "@lifi/widget";
import { useEffect, useMemo, useState } from "react";
import { useEthersProvider } from "./context/Web3Context";
import { magic } from "./servcies/magic";
import { useWallet } from "./context/WalletContext";
import { setupIonicReact } from '@ionic/react';
import { AuthBadge } from "./components/AuthBadge";

setupIonicReact({
  mode: 'ios',
});

const styleLogo =  {
  // margin: '15px auto 20px',
  padding:' 0px',
  maxWidth: '42px',
  cursor: 'pointer',
};

const styleChip = {
  position: 'absolute',
  bottom: '0rem',
  right: '-15px',
  transform: 'scale(0.6)',
  padding:' 0rem 0.5rem',
  margin: 0,
  '--color': 'var(--ion-color-primary)',
  '--background': 'var(--ion-color-warning)',
}

function App() {
  // Use the UserContext to get the current logged-in user
  const { user } = useUser();

  const { initializeWeb3 } = useEthersProvider();
  // load environment config
  const widgetConfig: WidgetConfig = useMemo((): WidgetConfig => {
    return {
      integrator: "cra-example",
      variant: "expandable",
      insurance: true,
      containerStyle: {
        border: `1px solid var(--ion-border-color)`,
        borderRadius: "24px",
      },
      theme: {
        shape: {
          borderRadius: 12,
          borderRadiusSecondary: 24,
        },
        palette: {
          background: {
            paper: 'rgb(39 39 71 / 80%)', // green
            // default: '#272747',
          },
          primary: {
            main: '#428cff',
          },
          // grey: {
          //   300: theme.palette.grey[300],
          //   800: theme.palette.grey[800],
          // },
        },
      },
      hiddenUI: [HiddenUI.Appearance, HiddenUI.Language, HiddenUI.PoweredBy],
      walletManagement: {
        connect: async () => {
          try {
            // Try to connect to the wallet using Magic's user interface
            await magic.wallet.connectWithUI();

            // If connection to the wallet was successful, initialize new Web3 instance
            const provider = await initializeWeb3();
            const signer = provider?.getSigner();
            console.log("signer", signer);
            if (!signer) {
              throw new Error("Signer not found");
            }
            // return signer instance from JsonRpcSigner
            return signer;
          } catch (error: any) {
            // Log any errors that occur during the connection process
            console.error("handleConnect:", error);
            throw new Error("handleConnect:" + error?.message);
          }
        },
        disconnect: async () => {
          try {
            // Try to disconnect the user's wallet using Magic's logout method
            await magic.user.logout();
            // After successful disconnection, re-initialize the Web3 instance
            initializeWeb3();
          } catch (error) {
            // Log any errors that occur during the disconnection process
            console.log("handleDisconnect:", error);
          }
        },
      },
      // set source chain to Polygon
      fromChain: 1,
      // set destination chain to Optimism
      toChain: 10,
      // set source token to ETH (Ethereum)
      fromToken: '0x0000000000000000000000000000000000000000',
      // set source token to USDC (Optimism)
      // toToken: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
      // // set source token amount to 10 USDC (Polygon)
      // fromAmount: 10,
    };
  }, [initializeWeb3]);

  // use state to handle segment change
  const [currentSegment, setSegment] = useState('swap');
  const handleSegmentChange = (e: any) => {
    setSegment(e.detail.value);
  };

  const renderSwitch = (param: string) => {
    switch(param) {
      case 'swap':
        return <LiFiWidget config={widgetConfig} integrator="cra-example" />;
      case 'fiat':
        return (
          <div style={{
            paddingBottom: '10rem',
            textAlign: 'center',
          }}>
            <iframe       
                style={{
                  maxWidth: '100vw',
                  border: 'solid 1px var(--ion-border-color)',
                  borderRadius: '32px',
                  overflow: 'hidden',
                  display: 'inline-block',
                }} 
                src="https://buy.onramper.com?themeName=dark&cardColor=272747cc&borderRadius=12px"
                title="Onramper Widget"
                height="630px"
                width="450px"
                allow="payment"
            />
          </div>
        );
      default:
        return (
          <div style={{
            textAlign: 'center',
          }}>
            <IonText color="medium">
              <h1>{currentSegment.toUpperCase()}</h1>
              <p>
                This feature is in development. <br/>
                Please check back later.
              </p>
            </IonText>
            <IonChip color="primary">Coming soon</IonChip>
          </div>
        );
    }
  }

  return (
    <IonApp>
      <IonRouterOutlet>
        <IonHeader translucent={true} class="ion-no-border">
          <IonToolbar style={{'--background': 'transparent'}}>
            <IonGrid class="ion-no-padding">
              <IonRow class="ion-align-items-center ion-justify-content-between">
                <IonCol size="2" class="ion-padding ion-text-start">
                  <div style={{position: 'relative', display: 'inline-block'}}>
                    <IonImg 
                      style={styleLogo} 
                      src="./assets/images/logo.svg"></IonImg>
                    <IonChip style={styleChip}>
                      beta
                    </IonChip>
                  </div>
                </IonCol>
                <IonCol size="auto" class="ion-padding">
                  <IonSegment mode="ios" value={currentSegment} onIonChange={(e: any) => handleSegmentChange(e)}>
                    <IonSegmentButton value="swap">
                      Exchange
                    </IonSegmentButton>
                    <IonSegmentButton value="defi">
                      Lending & Borrow
                    </IonSegmentButton>
                    <IonSegmentButton value="stacking">
                      Earn Interest
                    </IonSegmentButton>
                    <IonSegmentButton value="fiat">
                      Buy
                    </IonSegmentButton>
                  </IonSegment>
                </IonCol>
                <IonCol size="2"  class="ion-padding ion-text-end">
                  <AuthBadge user={user} />
                </IonCol>
                {/* <IonCol size="12">{AuthButton}</IonCol> */}
                {/* <IonCol size="12">{WalletInfo}</IonCol> */}
              </IonRow>
            </IonGrid>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen={true} className="ion-padding">
          <IonGrid class="ion-no-padding" style={{'height': '95vh'}}>
            <IonRow style={{height: '100%'}} class="ion-align-items-center ion-justify-content-center ion-no-padding">
              <IonCol size="12">
                {renderSwitch(currentSegment)}
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonContent>
      </IonRouterOutlet>
    </IonApp>
  );
}

export default App;
