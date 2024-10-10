import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InsightsService } from "@src/modules/common/services/insights.service";
import axios from "axios";
@Injectable()
export class HubSpotService {
  constructor(
    private readonly configService: ConfigService,
    private readonly insightsService: InsightsService,
  ) {}

  /**
   * Splits a full name into first name and last name.
   *
   * @param fullName - The full name of the contact.
   * @returns An object containing the `firstName` and `lastName` properties.
   */
  private splitName = (fullName: string) => {
    // Split the full name by spaces
    const nameParts = fullName.trim().split(" ");

    // If there's only one word, it's considered the first name
    if (nameParts.length === 1) {
      return {
        firstName: nameParts[0],
        lastName: "",
      };
    }

    // Join all parts except the last one as the first name
    const firstName = nameParts.slice(0, -1).join(" ");

    // The last word is the last name
    const lastName = nameParts[nameParts.length - 1];

    return {
      firstName: firstName,
      lastName: lastName,
    };
  };

  /**
   * Submits a contact in form inside a portal HubSpot with the given email and name.
   *
   * @param email - The email address of the contact.
   * @param name - The full name of the contact.
   * @returns The response from HubSpot if successful, otherwise logs the error.
   * @throws Logs the error and tracks it via Application Insights if contact creation fails.
   */
  async createContact(email: string, name: string) {
    try {
      const formId = this.configService.get("hubspot.formId");
      const portalId = this.configService.get("hubspot.portalId");
      const baseURL = this.configService.get("hubspot.baseURL");
      const url = `${baseURL}/submissions/v3/integration/submit/${portalId}/${formId}`;
      const nameData = this.splitName(name);
      // Prepare the submission data
      const data = {
        fields: [
          {
            name: "email",
            value: email,
          },
          {
            name: "firstname",
            value: nameData.firstName,
          },
          {
            name: "lastname",
            value: nameData.lastName,
          },
        ],
        legalConsentOptions: {
          consent: {
            consentToProcess: true,
            text: "I agree to allow Sparrow to store and process my personal data.",
            communications: [
              {
                value: "",
                subscriptionTypeId: 999,
                text: "I agree to receive marketing communications from Techdome.",
              },
            ],
          },
        },
      };
      const response = await axios.post(url, data, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response;
    } catch (error) {
      console.error("Error creating contact in HubSpot:", error);
      const client = this.insightsService.getClient();
      client.trackException({
        exception: error,
        properties: {
          status: "Failed",
          message: "Hubspot Service Failed",
        },
      });
    }
  }
}
