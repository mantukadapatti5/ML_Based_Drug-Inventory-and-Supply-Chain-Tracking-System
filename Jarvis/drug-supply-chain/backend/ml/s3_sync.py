import boto3
import os
from botocore.exceptions import NoCredentialsError
from dotenv import load_dotenv

load_dotenv()

class S3ModelSync:
    def __init__(self):
        self.bucket_name = os.getenv("AWS_S3_BUCKET", "pharma-models-sih")
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )

    def upload_model(self, local_path, s3_key=None):
        """
        Uploads a machine learning model to AWS S3 for versioning.
        """
        if s3_key is None:
            s3_key = os.path.basename(local_path)

        try:
            print(f"Syncing {local_path} to S3 bucket {self.bucket_name}...")
            self.s3_client.upload_file(local_path, self.bucket_name, s3_key)
            print(f"Successfully versioned {s3_key} in S3.")
            return True
        except FileNotFoundError:
            print(f"Error: Local file {local_path} not found.")
            return False
        except NoCredentialsError:
            print("Error: AWS credentials not configured. Skipping S3 sync.")
            return False
        except Exception as e:
            print(f"S3 Sync Error: {str(e)}")
            return False

# Singleton instance
s3_sync = S3ModelSync()
