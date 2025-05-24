// Cloud storage using the Backblaze S3 compatible API
package main

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	smithyendpoints "github.com/aws/smithy-go/endpoints"
)

type CloudStorage struct {
	client           *s3.Client
	bucketName       string
	allowedMimetypes []string
	fileSizeLimit    int64
}

type resolver struct {
	region     string
	bucketName string
}

// Make the resulting url use our custom backblaze url host
func (r *resolver) ResolveEndpoint(
	ctx context.Context, params s3.EndpointParameters,
) (smithyendpoints.Endpoint, error) {
	endpoint, err := s3.NewDefaultEndpointResolverV2().ResolveEndpoint(ctx, params)
	if err != nil {
		return smithyendpoints.Endpoint{}, err
	}

	endpoint.URI.Host = fmt.Sprintf("s3.%s.backblazeb2.com", r.region)
	endpoint.URI.Path = fmt.Sprintf("/%s", r.bucketName)

	return endpoint, nil
}

func NewCloudStorage(secrets map[string]string) (CloudStorage, error) {
	key := secrets["APP_SECRET_KEY"]
	keyId := secrets["APP_SECRET_KEY_ID"]

	// Create a new s3 client
	p := credentials.NewStaticCredentialsProvider(keyId, key, "")
	cfg, err := config.LoadDefaultConfig(context.
		TODO(), config.WithCredentialsProvider(p))
	if err != nil {
		return CloudStorage{}, err
	}

	region := secrets["BUCKET_REGION"]
	bucketName := secrets["BUCKET_NAME"]
	resolver := resolver{region, bucketName}
	client := s3.NewFromConfig(cfg, func(opts *s3.Options) {
		opts.EndpointResolverV2 = &resolver
		opts.Region = region
	})

	storage := CloudStorage{bucketName: bucketName, client: client}
	return storage, nil
}

// Get the file's data and mimetype
func (s *CloudStorage) GetFile(
	ctx context.Context, filename string,
) (io.ReadCloser, string, error) {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(filename),
	})
	return result.Body, *result.ContentType, err
}

func (s *CloudStorage) UploadFile(
	ctx context.Context, file io.Reader, filename string,
) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(filename),
		Body:   file,
	})
	return err
}

func (s *CloudStorage) RemoveFile(ctx context.Context, filename string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucketName),
		Key:    aws.String(filename),
	})
	return err
}
