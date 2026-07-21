from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Drug Supply Chain Backend"
    secret_key: str = "CHANGE_ME_TO_A_SECURE_RANDOM_VALUE"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # GxP Part 11 electronic signature salt (change in production)
    gxp_signature_salt: str = Field(
        default="GxP_Secure_Salt_2026_CHANGE_IN_PRODUCTION",
        validation_alias=AliasChoices("GXP_SIGNATURE_SALT", "GxP_Secure_Salt"),
    )

    database_url: str = "sqlite:///./drug_supply_chain.db"

    mongodb_url: str = Field(
        default="mongodb://mongo_admin:MongoPassword123@localhost:27017/?authSource=admin",
        validation_alias=AliasChoices("MONGODB_URL", "MONGO_URI"),
    )
    mongo_db: str = Field(
        default="drug_supply_chain",
        validation_alias=AliasChoices("MONGO_DB"),
    )

    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "pharma-influx-token"
    influxdb_org: str = "pharma_consortium"
    influxdb_bucket: str = "telemetry_stream"

    # Host machine: localhost / 19092. Inside Docker network: mosquitto / redpanda:9092
    mqtt_broker_host: str = Field(
        default="localhost",
        validation_alias=AliasChoices("MQTT_HOST", "MQTT_BROKER_HOST"),
    )
    mqtt_broker_port: int = Field(
        default=1883,
        validation_alias=AliasChoices("MQTT_PORT", "MQTT_BROKER_PORT"),
    )

    kafka_bootstrap_servers: str = Field(
        default="localhost:19092",
        validation_alias=AliasChoices("KAFKA_SERVERS", "KAFKA_BOOTSTRAP_SERVERS"),
    )

    # Phase 2: Hyperledger Fabric Configuration
    # Set FABRIC_MODE to "production" to use live Fabric network, "mock" for development
    fabric_mode: str = Field(
        default="mock",
        validation_alias=AliasChoices("FABRIC_MODE"),
    )
    
    fabric_peer_endpoint: str = Field(
        default="localhost:7051",
        validation_alias=AliasChoices("FABRIC_PEER_ENDPOINT"),
    )
    fabric_channel: str = Field(
        default="drugchannel",
        validation_alias=AliasChoices("FABRIC_CHANNEL"),
    )
    fabric_chaincode: str = Field(
        default="drug_provenance",
        validation_alias=AliasChoices("FABRIC_CHAINCODE", "FABRIC_CHAINCODE_NAME"),
    )
    fabric_msp_id: str = Field(
        default="Org1MSP",
        validation_alias=AliasChoices("FABRIC_MSP_ID"),
    )
    
    # Credential paths for Fabric Gateway (required for production mode)
    # Local test-network default: ~/.fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com
    fabric_cert_path: str = Field(
        default="",
        validation_alias=AliasChoices("FABRIC_CERT_PATH"),
    )
    fabric_key_path: str = Field(
        default="",
        validation_alias=AliasChoices("FABRIC_KEY_PATH"),
    )
    fabric_tls_cert_path: str = Field(
        default="",
        validation_alias=AliasChoices("FABRIC_TLS_CERT_PATH"),
    )
    
    # Gateway connection profile (optional, used by fabric-gateway v1.0+)
    fabric_connection_profile_path: str = Field(
        default="",
        validation_alias=AliasChoices("FABRIC_CONNECTION_PROFILE_PATH"),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")


settings = Settings()
