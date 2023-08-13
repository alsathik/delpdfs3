const express = require('express');
const app = express();
const cron = require('node-cron');
require('dotenv').config();



const { S3Client, ListObjectsCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const bucketName = process.env.BUCKET_NAME;
const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.accessKeyId,
        secretAccessKey: process.env.secretAccessKey,
    },
});


cron.schedule('0 * * * * *', async () => {
    const listObjectsParams = {
        Bucket: bucketName,
    };
    try {
        // List all objects in the bucket
        const listObjectsCommand = new ListObjectsCommand(listObjectsParams);
        const { Contents } = await s3Client.send(listObjectsCommand);
        Contents.forEach(element => {
            console.info(element);
        });
        // Filter and delete objects created 90 hours ago or beyond
        const currentTime = new Date();
        const objectsToDelete = Contents
            .filter(object => object.Key.endsWith('.pdf'))
            .filter((object) => {
                const objectCreationTime = object.LastModified;
                const timeDifference = currentTime - objectCreationTime;
                const hoursDifference = timeDifference / (1000 * 60 * 60);
                return hoursDifference >= 1;
            });
        if (objectsToDelete.length > 0) {
            const deleteParams = {
                Bucket: bucketName,
                Delete: {
                    Objects: objectsToDelete.map((object) => ({ Key: object.Key })),
                    Quiet: false,
                },
            };
            // Delete the filtered objects
            const deleteObjectsCommand = new DeleteObjectsCommand(deleteParams);
            await s3Client.send(deleteObjectsCommand);

            console.log(`Deleted ${objectsToDelete.length} objects from s3://${bucketName}`);
        } else {
            console.log(`No objects found to delete in s3://${bucketName}`);
        }
    } catch (ex) { }
});

const port = 3001;
app.listen(port, () => {
    console.log(`AWS Job app listening on port ${port}`)
});
