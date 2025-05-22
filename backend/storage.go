// Cloud storage using the Backblaze S3 compatible API
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	smithyendpoints "github.com/aws/smithy-go/endpoints"
)

type CloudStorage struct {
	client     *s3.Client
	bucketName string
}

type resolver struct {
	region     string
	bucketName string
}

func (r *resolver) ResolveEndpoint(
	ctx context.Context, params s3.EndpointParameters,
) (smithyendpoints.Endpoint, error) {
	endpoint, err := s3.NewDefaultEndpointResolverV2().ResolveEndpoint(ctx, params)
	if err != nil {
		return smithyendpoints.Endpoint{}, err
	}

	// Set our custom Backblaze URL
	endpoint.URI.Host = fmt.Sprintf("s3.%s.backblazeb2.com", r.region)
	endpoint.URI.Path = fmt.Sprintf("/%s", r.bucketName)

	return endpoint, nil
}

// Create a new S3 client
func NewCloudStorage(secrets map[string]string, bucketName, region string) (CloudStorage, error) {
	key := secrets["APP_SECRET_KEY"]
	keyId := secrets["APP_SECRET_KEY_ID"]

	p := credentials.NewStaticCredentialsProvider(keyId, key, "")
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithCredentialsProvider(p))
	if err != nil {
		return CloudStorage{}, err
	}

	resolver := resolver{region: region, bucketName: bucketName}
	client := s3.NewFromConfig(cfg, func(opts *s3.Options) {
		opts.EndpointResolverV2 = &resolver
		opts.Region = region
	})

	storage := CloudStorage{bucketName: bucketName, client: client}
	return storage, nil
}

func (s *CloudStorage) UploadFile(ctx context.Context, file io.Reader, filename string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(filename),
		Body:   file,
	})
	return err
}

// TODO: delete objects
// TODO: set up a backend endpoint that acts as a proxy. that way, we
// can fetch files from the cloud without exposing raw urls
func (s *CloudStorage) GetFile(ctx context.Context, filename string) error {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(filename),
	})
	if err != nil {
		return err
	}
	defer result.Body.Close()

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	body, err := io.ReadAll(result.Body)
	if err != nil {
		return err
	}

	_, err = file.Write(body)
	return err
}
