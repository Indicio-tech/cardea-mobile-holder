import React, {useState, useEffect, useContext} from 'react'

import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import {useHistory} from 'react-router-native'
import {
  CredentialEventType,
  CredentialState,
  JsonTransformer,
  OfferCredentialMessage,
} from 'aries-framework'

import AgentContext from '../AgentProvider/'
import Images from '@assets/images'
import AppStyles from '@assets/styles'
import Styles from './styles'
import credentialConfigs from '@configs/credentialConfigs.js'

import {getConnectionData, parseSchema} from '../../utils/'
import {getData} from '../../utils/storage'

function PendingTasks(props) {
  let history = useHistory()

  //Reference to the agent context
  const agentContext = useContext(AgentContext)

  //Get connection data for credential
  const getConnectionDataFromID = async (connectionID) => {
    const connection = await agentContext.agent.connections.find(connectionID)
    return getConnectionData(connection)
  }

  const [displayTasks, setDisplayTasks] = useState(false)
  const [trustedTraveler, setTrustedTraveler] = useState({'hasCredential': false, 'credentialType': 'labResult'})

  useEffect(() => {
    console.log('Checking if we should display tasks')

    if (credentialOffers.length > 0 || trustedTraveler) {
      setDisplayTasks(true)
    } else {
      setDisplayTasks(false)
    }
  })

  const [credentialOffers, setCredentialOffers] = useState([])

  const getCredOffers = async () => {
    const credentialRecords = await agentContext.agent.credentials.getAll()
    console.log('Fetched Credential Records', credentialRecords)

    const fetchedCredentialOffers = credentialRecords
      .filter(
        (credentialRecord) =>
          credentialRecord.state === CredentialState.OfferReceived,
      )
      .map((curr) => {
        //Get schema ID
        const schemaId = JsonTransformer.fromJSON(
          curr.offerMessage,
          OfferCredentialMessage,
        ).indyCredentialOffer.schema_id
        const credentialName = credentialConfigs[schemaId]
          ? credentialConfigs[schemaId].credentialName
          : parseSchema(schemaId)
        return {...curr, credentialName}
      })
    console.log('Credential Offers:', fetchedCredentialOffers)

    setCredentialOffers(fetchedCredentialOffers)
  }

  //Get trusted traveler availability from storage
  const getTrustedTraveler = async () => {
    const data = await getData('trustedTraveler')
    if (data) {
      console.log('Trusted Traveler Action Item display:', data)
      setTrustedTraveler(data)
    }
  }

  useEffect(() => {
    if (!agentContext.loading) {
      getCredOffers()
      getTrustedTraveler()
    }
  }, [agentContext.loading])

  const handleCredentialStateChange = async (event) => {
    console.log('Home - credentials event update')

    getCredOffers()
  }

  useEffect(() => {
    if (!agentContext.loading) {
      agentContext.agent.credentials.events.on(
        CredentialEventType.StateChanged,
        handleCredentialStateChange,
      )

      return function () {
        agentContext.agent.credentials.events.removeListener(
          CredentialEventType.StateChanged,
          handleCredentialStateChange,
        )
      }
    }
  })

  const requestTrustedTraveler = ( credentialType ) => {
    console.log('Requesting Trusted Traveler')
      switch (credentialType) {
        case 'labResult' : history.push('/workflow/accepted-test-result') 
        break
        case 'exemption' : history.push('/workflow/accepted-vaccination-exemption')
        break
        case 'vaccination' : history.push('/workflow/accepted-vaccination')
        break
        default : console.warn(`Unrecognized Credential Type : ${credentialType}`)
      }
    }

  const doTask = async (credentialRecord) => {
    console.log('Credential Record', credentialRecord)
    const connectionRecord = await agentContext.agent.connections.getById(
      credentialRecord.connectionId,
    )

    props.setConnection(connectionRecord)
    console.log(credentialRecord.offerMessage.credential_preview)
    const previewAttributes =
      credentialRecord.offerMessage.credential_preview.attributes
    console.log(previewAttributes)
    let attributes = {}
    for (const index in previewAttributes) {
      attributes[previewAttributes[index].name] = previewAttributes[index].value
    }

    let offer = JsonTransformer.fromJSON(
      credentialRecord.offerMessage,
      OfferCredentialMessage,
    )

    let credentialToDisplay = {
      attributes,
      connectionId: credentialRecord.connectionId,
      connection: await getConnectionDataFromID(credentialRecord.connectionId),
      id: credentialRecord.id,
      fullRecord: credentialRecord,
      schemaId: offer.indyCredentialOffer.schema_id,
    }
    if (credentialConfigs[credentialToDisplay.schemaId]) {
      credentialToDisplay.credentialName =
        credentialConfigs[credentialToDisplay.schemaId].credentialName
    }

    console.log('----------------------------------------')
    console.log('credentialToDisplay', credentialToDisplay)

    props.setCredential(credentialToDisplay)
    history.push('/workflow/offered')
  }

  console.log(
    `Display Tasks: ${displayTasks}, Trusted Traveler: ${trustedTraveler}`,
  )
  return (
    <View style={Styles.viewFull}>
      <View style={Styles.redBar}>
        <Text style={AppStyles.textWhite}>Action Items</Text>
      </View>
      <View style={AppStyles.flexView}>
        {displayTasks ? (
          <>
            {trustedTraveler.hasCredential && (
              <TouchableOpacity
                style={Styles.itemBox}
                onPress={() => {
                  requestTrustedTraveler( trustedTraveler.credentialType )
                }}>
                <Text
                  style={[
                    AppStyles.textWhite,
                    AppStyles.textUpper,
                    AppStyles.textCenter,
                  ]}>
                  Get Your Trusted Traveler
                </Text>
              </TouchableOpacity>
            )}
            {credentialOffers.map((child, index) => {
              return (
                <TouchableOpacity
                  key={index}
                  style={Styles.itemBox}
                  onPress={() => {
                    console.log('Doing cred offer')

                    doTask(child)
                  }}>
                  <Text
                    style={[
                      AppStyles.textWhite,
                      AppStyles.textUpper,
                      AppStyles.textCenter,
                    ]}>
                    {`Claim ${child.credentialName}`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </>
        ) : (
          <View style={Styles.emptyBox}>
            <Text style={[AppStyles.textGray]}>No Action Items</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default PendingTasks
