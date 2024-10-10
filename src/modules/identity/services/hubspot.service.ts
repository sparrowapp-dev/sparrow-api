import { Injectable } from "@nestjs/common";
import { Client } from "@hubspot/api-client";
import { ConfigService } from "@nestjs/config";
import { InsightsService } from "@src/modules/common/services/insights.service";

@Injectable()
export class HubSpotService {
  private hubspotClient: Client;

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
   * Creates a contact in HubSpot with the given email and name.
   *
   * @param email - The email address of the contact.
   * @param name - The full name of the contact.
   * @returns The response from HubSpot if successful, otherwise logs the error.
   * @throws Logs the error and tracks it via Application Insights if contact creation fails.
   */
  async createContact(email: string, name: string) {
    try {
      // Initialize the HubSpot client with an access token from config
      this.hubspotClient = new Client({
        accessToken: this.configService.get("hubspot.appToken"),
      });
      const nameData = this.splitName(name);
      const contact = {
        properties: {
          email,
          firstname: nameData.firstName,
          lastname: nameData.lastName,
        },
      };
      // Send the contact data to HubSpot's API and return the result
      const result = await this.hubspotClient.crm.contacts.basicApi.create(
        contact,
      );
      return result;
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
